
import express from "express";
import dotenv from "dotenv";
import db from './database.js';
import multer from "multer";
import fs from "fs";
import path from "path";
import { createHash, randomBytes, scrypt, timingSafeEqual } from "crypto";
import { promisify } from "util";
import * as THREE from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";

dotenv.config();
const allowedFrontendOrigins = new Set([
    "http://localhost:3000",
    process.env.FRONTEND_ORIGIN,
    process.env.FRONTEND_URL,
].filter(Boolean));

const app = express();
const scryptAsync = promisify(scrypt);
const SESSION_COOKIE = "shop_session";
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;
const authRateLimits = new Map();

// Data directories
// For Render persistent disk, set NEXUS3D_DATA_DIR=/var/data (and mount a disk there).
const DATA_DIR = (typeof process.env.NEXUS3D_DATA_DIR === "string" && process.env.NEXUS3D_DATA_DIR.length)
    ? process.env.NEXUS3D_DATA_DIR
    : process.cwd();
const UPLOADS_DIR = path.join(DATA_DIR, "uploads");
const PRODUCT_UPLOADS_DIR = path.join(UPLOADS_DIR, "products");
const CATEGORY_UPLOADS_DIR = path.join(UPLOADS_DIR, "categories");
const COMENZI_DIR = path.join(DATA_DIR, "comenzi_primite");

// Export behavior (disk usage control)
// Defaults are space-friendly:
// - overwrite the original STL in the order folder with the transformed output
// - do NOT keep *_ORIG or *_TRANSFORMED copies
// - do NOT write the combined assembly STL
// You can enable extras via env vars.
const EXPORT_OPTS = {
    overwriteOriginal: process.env.NEXUS3D_OVERWRITE_ORIGINAL !== "0", // default true
    keepOrigBackup: process.env.NEXUS3D_KEEP_ORIG === "1", // default false
    writeSeparateTransformed: process.env.NEXUS3D_WRITE_SEPARATE_TRANSFORMED === "1", // default false
    writeAssembly: process.env.NEXUS3D_WRITE_ASSEMBLY === "1", // default false
    writeMeta: process.env.NEXUS3D_WRITE_META !== "0", // default true
};

// JSON parser (scoped to routes that need it)
// Accept JSON even if a client mistakenly sends it as text/plain.
const jsonParser = express.json({
    limit: "5mb",
    type: ["application/json", "application/*+json", "text/plain"],
});

// Configurare Multer
const upload = multer({ dest: UPLOADS_DIR });
const productImageExtensions = new Map([
    ["image/jpeg", ".jpg"],
    ["image/png", ".png"],
    ["image/webp", ".webp"],
    ["image/avif", ".avif"],
]);
const productImageUpload = multer({
    storage: multer.diskStorage({
        destination: PRODUCT_UPLOADS_DIR,
        filename: (req, file, callback) => {
            const extension = productImageExtensions.get(file.mimetype);
            callback(null, `${Date.now()}-${randomBytes(12).toString("hex")}${extension}`);
        },
    }),
    limits: { fileSize: 8 * 1024 * 1024, files: 12 },
    fileFilter: (req, file, callback) => {
        const extension = productImageExtensions.get(file.mimetype);
        const originalExtension = path.extname(file.originalname).toLowerCase();
        if (!extension || originalExtension !== extension && !(extension === ".jpg" && originalExtension === ".jpeg")) {
            return callback(new Error("Încarcă imagini JPG, PNG, WebP sau AVIF."));
        }
        callback(null, true);
    },
});
const categoryImageUpload = multer({
    storage: multer.diskStorage({
        destination: CATEGORY_UPLOADS_DIR,
        filename: (req, file, callback) => {
            const extension = productImageExtensions.get(file.mimetype);
            callback(null, `${Date.now()}-${randomBytes(12).toString("hex")}${extension}`);
        },
    }),
    limits: { fileSize: 8 * 1024 * 1024, files: 1 },
    fileFilter: (req, file, callback) => {
        const extension = productImageExtensions.get(file.mimetype);
        const originalExtension = path.extname(file.originalname).toLowerCase();
        if (!extension || originalExtension !== extension && !(extension === ".jpg" && originalExtension === ".jpeg")) {
            return callback(new Error("Încarcă imagini JPG, PNG, WebP sau AVIF."));
        }
        callback(null, true);
    },
});

// 1. Asigurăm existența folderelor
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(PRODUCT_UPLOADS_DIR)) fs.mkdirSync(PRODUCT_UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(CATEGORY_UPLOADS_DIR)) fs.mkdirSync(CATEGORY_UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(COMENZI_DIR)) fs.mkdirSync(COMENZI_DIR, { recursive: true });

app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && allowedFrontendOrigins.has(origin)) {
        res.header("Access-Control-Allow-Origin", origin);
        res.header("Access-Control-Allow-Credentials", "true");
        res.header("Vary", "Origin");
    }

    res.header("Access-Control-Allow-Headers", "Content-Type");
    res.header("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
    if (req.method === "OPTIONS") return res.sendStatus(200);
    next();
});

app.use("/uploads", express.static(UPLOADS_DIR));

app.get("/health", (req, res) => {
    res.json({ ok: true, service: "nexus3d-backend", multiFile: true, date: "2026-02-04" });
});

app.post("/api/auth/check-email", jsonParser, rateLimitAuth(30, 15 * 60 * 1000), (req, res) => {
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: "Introdu o adresă de email validă." });
    }

    try {
        db.prepare("DELETE FROM user_sessions WHERE expires_at <= ?").run(Date.now());
        const account = db.prepare("SELECT 1 FROM users WHERE LOWER(email) = ? LIMIT 1").get(email);
        res.json({ email, accountExists: Boolean(account) });
    } catch (error) {
        console.error("Eroare la verificarea emailului pentru autentificare:", error);
        res.status(500).json({ error: "Emailul nu a putut fi verificat momentan." });
    }
});

function rateLimitAuth(limit, windowMs) {
    return (req, res, next) => {
        const now = Date.now();
        const key = `${req.ip ?? req.socket.remoteAddress ?? "unknown"}:${req.path}`;
        const current = authRateLimits.get(key);
        if (!current || current.resetAt <= now) {
            authRateLimits.set(key, { count: 1, resetAt: now + windowMs });
        } else if (current.count >= limit) {
            res.set("Retry-After", String(Math.ceil((current.resetAt - now) / 1000)));
            return res.status(429).json({ error: "Prea multe încercări. Te rugăm să încerci din nou mai târziu." });
        } else {
            current.count += 1;
        }
        if (authRateLimits.size > 1000) {
            for (const [entryKey, value] of authRateLimits) {
                if (value.resetAt <= now) authRateLimits.delete(entryKey);
            }
            while (authRateLimits.size > 2000) {
                authRateLimits.delete(authRateLimits.keys().next().value);
            }
        }
        next();
    };
}

function requireTrustedAuthOrigin(req, res, next) {
    const origin = req.headers.origin;
    if (origin && !allowedFrontendOrigins.has(origin)) {
        return res.status(403).json({ error: "Originea cererii nu este permisă." });
    }
    next();
}

function requireOwner(req, res, next) {
    const user = getAuthenticatedUser(req);
    if (!user) return res.status(401).json({ error: "Trebuie să te conectezi pentru a accesa această pagină." });
    if (typeof user.role !== "string" || user.role.toLowerCase() !== "owner") {
        return res.status(403).json({ error: "Nu ai permisiunea de a accesa această resursă." });
    }
    req.authenticatedUser = user;
    next();
}

function normalizeEmail(value) {
    return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function getSessionToken(req) {
    const cookieHeader = req.headers.cookie ?? "";
    const sessionCookie = cookieHeader
        .split(";")
        .map((cookie) => cookie.trim())
        .find((cookie) => cookie.startsWith(`${SESSION_COOKIE}=`));
    return sessionCookie ? decodeURIComponent(sessionCookie.slice(SESSION_COOKIE.length + 1)) : "";
}

function hashSessionToken(token) {
    return createHash("sha256").update(token).digest("hex");
}

function setSessionCookie(res, token) {
    const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
    const sameSite = secure ? "None" : "Lax";
    res.setHeader(
        "Set-Cookie",
        `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=${sameSite}; Max-Age=${Math.floor(SESSION_DURATION_MS / 1000)}${secure}`,
    );
}

function clearSessionCookie(res) {
    const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
    const sameSite = secure ? "None" : "Lax";
    res.setHeader("Set-Cookie", `${SESSION_COOKIE}=; HttpOnly; Path=/; SameSite=${sameSite}; Max-Age=0${secure}`);
}

async function createPasswordHash(password) {
    const salt = randomBytes(16);
    const hash = await scryptAsync(password, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
    return `scrypt$16384$8$1$${salt.toString("hex")}$${Buffer.from(hash).toString("hex")}`;
}

async function verifyPassword(password, storedHash) {
    const parts = typeof storedHash === "string" ? storedHash.split("$") : [];
    if (parts.length !== 6 || parts[0] !== "scrypt" || parts[1] !== "16384" || parts[2] !== "8" || parts[3] !== "1") {
        await scryptAsync(password, "invalid-account-salt", 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
        return false;
    }
    const salt = Buffer.from(parts[4], "hex");
    const expected = Buffer.from(parts[5], "hex");
    if (salt.length !== 16 || expected.length !== 64) return false;
    const actual = Buffer.from(await scryptAsync(password, salt, expected.length, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }));
    return timingSafeEqual(actual, expected);
}

function createUserSession(userId, res) {
    const token = randomBytes(32).toString("hex");
    const expiresAt = Date.now() + SESSION_DURATION_MS;
    db.prepare("INSERT INTO user_sessions (user_id, token_hash, expires_at) VALUES (?, ?, ?)")
        .run(userId, hashSessionToken(token), expiresAt);
    setSessionCookie(res, token);
}

function getAuthenticatedUser(req) {
    const token = getSessionToken(req);
    if (!/^[a-f0-9]{64}$/.test(token)) return null;
    const now = Date.now();
    const session = db.prepare(`
        SELECT u.id, u.first_name AS firstName, u.last_name AS lastName, u.email, u.role
        FROM user_sessions s
        INNER JOIN users u ON u.id = s.user_id
        WHERE s.token_hash = ? AND s.expires_at > ?
    `).get(hashSessionToken(token), now);
    if (!session) {
        db.prepare("DELETE FROM user_sessions WHERE token_hash = ? OR expires_at <= ?")
            .run(hashSessionToken(token), now);
        return null;
    }
    return session;
}

app.post("/api/auth/register", jsonParser, rateLimitAuth(10, 15 * 60 * 1000), requireTrustedAuthOrigin, async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    const name = typeof req.body?.name === "string" ? req.body.name.trim().replace(/\s+/g, " ") : "";
    const phone = typeof req.body?.phone === "string" ? req.body.phone.trim() : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    const acceptedTerms = req.body?.acceptedTerms === true;

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: "Introdu o adresă de email validă." });
    }
    if (name.length < 2 || name.length > 120) {
        return res.status(400).json({ error: "Introdu numele complet (minimum 2 caractere)." });
    }
    if (phone.length > 40 || (phone && phone.length < 6)) {
        return res.status(400).json({ error: "Numărul de telefon nu este valid." });
    }
    if (password.length < 8 || password.length > 128 || !/\d/.test(password) || !/[^a-zA-Z0-9]/.test(password)) {
        return res.status(400).json({ error: "Parola trebuie să aibă 8–128 caractere și să conțină o cifră și un simbol." });
    }
    if (!acceptedTerms) {
        return res.status(400).json({ error: "Trebuie să accepți termenii și condițiile pentru a crea contul." });
    }

    try {
        const passwordHash = await createPasswordHash(password);
        const nameParts = name.split(" ");
        const firstName = nameParts.shift();
        const lastName = nameParts.join(" ");
        const createUser = db.transaction(() => {
            const existing = db.prepare("SELECT id FROM users WHERE LOWER(email) = ? LIMIT 1").get(email);
            if (existing) return null;
            const result = db.prepare(`
                INSERT INTO users (first_name, last_name, email, phone, password, terms_accepted_at)
                VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            `).run(firstName, lastName, email, phone || null, passwordHash);
            return Number(result.lastInsertRowid);
        });
        const userId = createUser();
        if (!userId) {
            return res.status(409).json({ error: "Există deja un cont cu acest email. Conectează-te cu parola." });
        }
        createUserSession(userId, res);
        res.status(201).json({ user: db.prepare("SELECT id, first_name AS firstName, email FROM users WHERE id = ?").get(userId) });
    } catch (error) {
        console.error("Eroare la crearea contului:", error);
        res.status(500).json({ error: "Contul nu a putut fi creat momentan." });
    }
});

app.post("/api/auth/login", jsonParser, rateLimitAuth(10, 15 * 60 * 1000), requireTrustedAuthOrigin, async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !password || password.length > 128) {
        return res.status(400).json({ error: "Emailul sau parola nu sunt corecte." });
    }

    try {
        const user = db.prepare("SELECT id, first_name AS firstName, email, password, role FROM users WHERE LOWER(email) = ? LIMIT 1").get(email);
        const passwordMatches = await verifyPassword(password, user?.password);
        if (!user || !passwordMatches) {
            return res.status(401).json({ error: "Emailul sau parola nu sunt corecte." });
        }

        createUserSession(user.id, res);
        res.json({ user: { id: user.id, firstName: user.firstName, email: user.email, role: user.role } });
    } catch (error) {
        console.error("Eroare la conectarea utilizatorului:", error);
        res.status(500).json({ error: "Conectarea nu a reușit momentan." });
    }
});

app.get("/api/auth/me", (req, res) => {
    try {
        res.json({ user: getAuthenticatedUser(req) });
    } catch (error) {
        console.error("Eroare la verificarea sesiunii:", error);
        res.status(500).json({ error: "Sesiunea nu a putut fi verificată momentan." });
    }
});

app.post("/api/auth/logout", jsonParser, requireTrustedAuthOrigin, (req, res) => {
    try {
        const token = getSessionToken(req);
        if (token) db.prepare("DELETE FROM user_sessions WHERE token_hash = ?").run(hashSessionToken(token));
        clearSessionCookie(res);
        res.json({ success: true });
    } catch (error) {
        console.error("Eroare la deconectarea utilizatorului:", error);
        res.status(500).json({ error: "Deconectarea nu a reușit momentan." });
    }
});

function normalizeFilesFromBody(body) {
    let files = body?.files;
    if (!files && body?.serverFileName) {
        files = [{ serverFileName: body.serverFileName, originalName: body.originalName || body.serverFileName }];
    }
    if (!Array.isArray(files)) return [];
    return files
        .map((f) => ({
            serverFileName: f?.serverFileName,
            originalName: f?.originalName,
            transform: f?.transform,
        }))
        .filter((f) => typeof f.serverFileName === "string" && f.serverFileName.length);
}

function saveOrderToDisk({ offerText, files }) {
    const ordersFolder = COMENZI_DIR;

    const stamp = Date.now();
    const firstName = (files[0]?.originalName || "Comanda").split(".")[0].replace(/\s+/g, "_");
    const orderFolderName = `Comanda_${stamp}_${firstName}_${files.length}f`;
    const orderPath = path.join(ordersFolder, orderFolderName);

    if (!fs.existsSync(orderPath)) fs.mkdirSync(orderPath);

    // Move/copy STL-urile din uploads în folderul comenzii
    for (const f of files) {
        const serverFileName = f?.serverFileName;
        if (!serverFileName) continue;
        const uploadPath = path.join(UPLOADS_DIR, serverFileName);
        const destStlPath = path.join(orderPath, serverFileName);

        if (fs.existsSync(uploadPath)) {
            fs.copyFileSync(uploadPath, destStlPath);
            fs.unlinkSync(uploadPath);
        } else {
            const err = new Error(`Fișierul STL a expirat sau nu există: ${serverFileName}`);
            err.code = "FILE_MISSING";
            throw err;
        }
    }

    // Export STL-uri transformate (orientare/scalare/poziție)
    const exporter = new STLExporter();
    const worldToSlicer = new THREE.Matrix4().makeRotationX(Math.PI / 2);
    const effectiveWriteSeparateTransformed = EXPORT_OPTS.writeSeparateTransformed || !EXPORT_OPTS.overwriteOriginal;
    const assemblyScene = EXPORT_OPTS.writeAssembly ? new THREE.Scene() : null;
    let transformedCount = 0;

    const transformMeta = EXPORT_OPTS.writeMeta
        ? {
              createdAt: new Date().toISOString(),
              note: "Transformari primite din estimator (Three.js matrixWorld). Geometria este centrată înainte de aplicarea matricii. La export se convertește din coordonate Three.js (Y-up) în coordonate slicer (Z-up). Se poate exporta opțional și un STL de ansamblu (ASAMBLU_TRANSFORMAT.stl) care păstrează pozițiile relative dintre mai multe piese.",
              files: [],
          }
        : null;

    for (const f of files) {
        const serverFileName = f?.serverFileName;
        if (!serverFileName) continue;

        const t = f?.transform;
        const matrixArr = t?.matrixWorld;
        const hasMatrix = Array.isArray(matrixArr) && matrixArr.length === 16 && matrixArr.every((n) => typeof n === "number" && isFinite(n));

        if (transformMeta) {
            transformMeta.files.push({
                serverFileName,
                originalName: f?.originalName || serverFileName,
                transform: hasMatrix ? t : null,
            });
        }

        if (!hasMatrix) continue;

        const stlPath = path.join(orderPath, serverFileName);
        const stlData = fs.readFileSync(stlPath);
        const arrayBuffer = stlData.buffer.slice(stlData.byteOffset, stlData.byteOffset + stlData.byteLength);
        const loader = new STLLoader();
        const geometry = loader.parse(arrayBuffer);

        geometry.computeBoundingBox();
        geometry.center();

        const mtx = new THREE.Matrix4().fromArray(matrixArr);
        const finalMtx = worldToSlicer.clone().multiply(mtx);
        geometry.applyMatrix4(finalMtx);
        geometry.computeVertexNormals();

        const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial());
        const out = exporter.parse(mesh, { binary: true });
        let outBuf;
        if (typeof out === "string") outBuf = Buffer.from(out, "utf8");
        else if (out instanceof ArrayBuffer) outBuf = Buffer.from(out);
        else if (ArrayBuffer.isView(out)) outBuf = Buffer.from(out.buffer, out.byteOffset, out.byteLength);
        else throw new Error("STLExporter returned an unsupported output type");

        const parsed = path.parse(serverFileName);

        if (effectiveWriteSeparateTransformed) {
            const transformedName = `${parsed.name}_TRANSFORMED${parsed.ext || ".stl"}`;
            const transformedPath = path.join(orderPath, transformedName);
            fs.writeFileSync(transformedPath, outBuf);
        }

        if (EXPORT_OPTS.overwriteOriginal) {
            try {
                if (EXPORT_OPTS.keepOrigBackup) {
                    const origBackupName = `${parsed.name}_ORIG${parsed.ext || ".stl"}`;
                    const origBackupPath = path.join(orderPath, origBackupName);
                    if (!fs.existsSync(origBackupPath) && fs.existsSync(stlPath)) fs.copyFileSync(stlPath, origBackupPath);
                }
                fs.writeFileSync(stlPath, outBuf);
            } catch (e) {
                console.warn("Could not overwrite original STL with transformed output:", e);
            }
        }

        if (EXPORT_OPTS.overwriteOriginal || effectiveWriteSeparateTransformed) transformedCount++;

        if (assemblyScene) {
            try {
                const assemblyGeom = geometry.clone();
                const assemblyMesh = new THREE.Mesh(assemblyGeom, new THREE.MeshStandardMaterial());
                assemblyScene.add(assemblyMesh);
            } catch {
                // ignore assembly failures
            }
        }
    }

    let assemblyWritten = false;
    if (assemblyScene && assemblyScene.children && assemblyScene.children.length) {
        const outAll = exporter.parse(assemblyScene, { binary: true });
        let outAllBuf;
        if (typeof outAll === "string") outAllBuf = Buffer.from(outAll, "utf8");
        else if (outAll instanceof ArrayBuffer) outAllBuf = Buffer.from(outAll);
        else if (ArrayBuffer.isView(outAll)) outAllBuf = Buffer.from(outAll.buffer, outAll.byteOffset, outAll.byteLength);
        else throw new Error("STLExporter returned an unsupported output type (assembly)");
        const assemblyPath = path.join(orderPath, "ASAMBLU_TRANSFORMAT.stl");
        fs.writeFileSync(assemblyPath, outAllBuf);
        assemblyWritten = true;
    }

    if (transformMeta) {
        const metaPath = path.join(orderPath, "TRANSFORMARI.json");
        fs.writeFileSync(metaPath, JSON.stringify(transformMeta, null, 2), "utf8");
    }

    const txtPath = path.join(orderPath, "DETALII_COMANDA.txt");
    fs.writeFileSync(txtPath, offerText, "utf8");

    return { orderPath, orderFolderName, transformedCount, fileCount: files.length, assemblyWritten };
}

// Funcție calcul volum
function calculateVolume(geometry) {
    let volume = 0;
    const position = geometry.getAttribute("position");
    if (!position) return 0;
    for (let i = 0; i < position.count; i += 3) {
        const p1 = new THREE.Vector3().fromBufferAttribute(position, i);
        const p2 = new THREE.Vector3().fromBufferAttribute(position, i + 1);
        const p3 = new THREE.Vector3().fromBufferAttribute(position, i + 2);
        const cross = new THREE.Vector3().crossVectors(p2, p3);
        volume += p1.dot(cross) / 6.0;
    }
    return Math.abs(volume);
}

// --- ENDPOINT 1: UPLOAD & CALCUL (Temporar) ---
app.post("/upload", upload.single("file"), (req, res) => {
    if (!req.file) return res.status(400).json({ error: "Lipsă fișier" });

    try {
        const fileData = fs.readFileSync(req.file.path);
        const arrayBuffer = fileData.buffer.slice(fileData.byteOffset, fileData.byteOffset + fileData.byteLength);
        const loader = new STLLoader();
        const geometry = loader.parse(arrayBuffer);
        
        const volume_mm3 = calculateVolume(geometry);
        
        // Salvăm fișierul în 'uploads' cu numele original pentru a-l putea muta mai târziu
        // Adăugăm un timestamp ca să nu se suprascrie dacă doi clienți încarcă "piesa.stl"
        const uniquePrefix = Date.now() + '-';
        const finalName = uniquePrefix + req.file.originalname.replace(/\s+/g, '_');
        const newPath = path.join(UPLOADS_DIR, finalName);
        
        fs.renameSync(req.file.path, newPath);

        res.json({
            volume_cm3: volume_mm3 / 1000,
            serverFileName: finalName // Trimitem numele înapoi ca frontend-ul să știe ce să ceară la comandă
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Eroare procesare" });
    }
});

// --- ENDPOINT 2: SALVARE COMANDĂ FINALĂ ---
app.post("/comanda", jsonParser, (req, res) => {
    // Some clients can still deliver JSON as a raw string even with content-type set.
    // Try to recover gracefully.
    let body = req.body;
    if (typeof body === "string") {
        try { body = JSON.parse(body); } catch { body = {}; }
    }

    const { offerText } = body;
    const files = normalizeFilesFromBody(body);
    const amountLei = Number(body?.amountLei);
    const firstName = typeof body?.firstName === "string" ? body.firstName.trim() : "";
    const lastName = typeof body?.lastName === "string" ? body.lastName.trim() : "";
    const email = normalizeEmail(body?.email);
    const phone = typeof body?.phone === "string" ? body.phone.trim() : "";
    const shippingAddress = typeof body?.shippingAddress === "string" ? body.shippingAddress.trim() : "";

    if (!offerText || !files || files.length === 0) {
        return res.status(400).json({ success: false, msg: "Date incomplete" });
    }
    if (!Number.isFinite(amountLei) || amountLei <= 0 || amountLei > 1000000) {
        return res.status(400).json({ success: false, msg: "Suma comenzii este invalidă." });
    }
    if (firstName.length < 1 || firstName.length > 100 || lastName.length < 1 || lastName.length > 100) {
        return res.status(400).json({ success: false, msg: "Introdu numele și prenumele." });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || phone.length < 6 || phone.length > 40 || shippingAddress.length < 5 || shippingAddress.length > 500) {
        return res.status(400).json({ success: false, msg: "Verifică emailul, telefonul și adresa de livrare." });
    }

    try {
        const saved = saveOrderToDisk({ offerText, files });
        const user = getAuthenticatedUser(req);
        const result = db.transaction(() => {
            const order = db.prepare(`
                INSERT INTO orders (user_id, first_name, last_name, email, phone, shipping_address, total_price, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
            `).run(user?.id ?? null, firstName, lastName, email, phone, shippingAddress, amountLei);
            db.prepare(`
                INSERT INTO order_items (order_id, product_name, color, infill, scale_pct, quantity, price)
                VALUES (?, ?, ?, ?, ?, 1, ?)
            `).run(
                order.lastInsertRowid,
                `Comandă personalizată 3D (${files.length} ${files.length === 1 ? "fișier" : "fișiere"})`,
                typeof body.color === "string" ? body.color.slice(0, 40) : null,
                Number.isInteger(Number(body.infill)) ? Number(body.infill) : null,
                Number.isFinite(Number(body.scalePct)) ? Number(body.scalePct) : null,
                amountLei,
            );
            if (user?.id) db.prepare("UPDATE users SET phone = ? WHERE id = ?").run(phone, user.id);
            return Number(order.lastInsertRowid);
        })();

        console.log(`✅ Comandă nouă salvată în: ${saved.orderPath}`);
        console.log(
            `   ↳ Transform exports: ${saved.transformedCount}/${files.length}, assembly: ${saved.assemblyWritten ? "yes" : "no"}, meta: ${EXPORT_OPTS.writeMeta ? "yes" : "no"}`
        );
        console.log(
            `   ↳ Export opts: overwriteOriginal=${EXPORT_OPTS.overwriteOriginal ? "1" : "0"}, keepOrig=${EXPORT_OPTS.keepOrigBackup ? "1" : "0"}, separateTransformed=${EXPORT_OPTS.writeSeparateTransformed ? "1" : "0"}, assembly=${EXPORT_OPTS.writeAssembly ? "1" : "0"}`
        );
        res.status(201).json({ success: true, msg: "Comanda a fost înregistrată cu succes!", orderId: result, transformedCount: saved.transformedCount, fileCount: saved.fileCount, assemblyWritten: saved.assemblyWritten });

    } catch (err) {
        console.error("Eroare la salvare comandă:", err);
        res.status(500).json({ success: false, msg: "Eroare server la salvare." });
    }
});

const PORT = Number(process.env.PORT) || 5000;

const productWithCategoryQuery = `
    SELECT
        p.id,
        p.name,
        p.slug,
        p.price,
        p.description,
        p.category_id,
        c.name AS category,
        c.slug AS category_slug,
        p.image_url,
        p.is_featured,
        p.created_at
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
`;

// 1. Returnează toate produsele (cu tot cu prima imagine sau copertă)
app.get("/api/products", (req, res) => {
    try {
        const products = db.prepare(`${productWithCategoryQuery} ORDER BY p.id`).all();

        // Opțional: putem atașa imaginile pentru fiecare produs în parte
        const productsWithImages = products.map(product => {
            const images = db.prepare('SELECT image_url FROM product_images WHERE product_id = ?').all(product.id);
            const tags = db.prepare('SELECT tag FROM product_tags WHERE product_id = ? ORDER BY tag').all(product.id);
            return {
                ...product,
                images: images.map(img => img.image_url),
                tags: tags.map(item => item.tag)
            };
        });

        res.json(productsWithImages);
    } catch (err) {
        console.error("Eroare la preluarea produselor:", err);
        res.status(500).json({ error: "Eroare de server." });
    }
});

// 2. Returnează un singur produs după slug, împreună cu galeria lui de imagini
app.get("/api/products/:slug", (req, res) => {
    try {
        const productSlug = req.params.slug;
        const product = db.prepare(`${productWithCategoryQuery} WHERE p.slug = ?`).get(productSlug);

        if (!product) {
            return res.status(404).json({ error: "Produsul nu a fost găsit." });
        }

        // Preluăm toate imaginile asociate acestui produs din tabela nouă
        const images = db.prepare('SELECT image_url FROM product_images WHERE product_id = ?').all(product.id);
        const tags = db.prepare('SELECT tag FROM product_tags WHERE product_id = ? ORDER BY tag').all(product.id);

        // Returnăm produsul combinat cu array-ul de imagini
        res.json({
            ...product,
            images: images.map(img => img.image_url),
            tags: tags.map(item => item.tag)
        });
    } catch (err) {
        console.error("Eroare la preluarea produsului:", err);
        res.status(500).json({ error: "Eroare de server." });
    }
});

app.get("/api/categories", (req, res) => {
    try {
        const categories = db.prepare(`
            SELECT c.id, c.name, c.slug, c.image_url, COUNT(p.id) AS product_count
            FROM categories c
            LEFT JOIN products p ON p.category_id = c.id
            GROUP BY c.id
            ORDER BY c.id
        `).all();

        res.json(categories);
    } catch (err) {
        console.error("Eroare la preluarea categoriilor:", err);
        res.status(500).json({ error: "Eroare de server." });
    }
});

function buildCartQuote(items, couponCode) {
    if (!Array.isArray(items) || items.length === 0 || items.length > 50) {
        throw Object.assign(new Error("Coșul este gol sau conține prea multe produse."), { status: 400 });
    }

    const quantities = new Map();
    for (const item of items) {
        const productId = Number(item?.productId);
        const quantity = Number(item?.quantity);
        if (!Number.isInteger(productId) || productId < 1 || !Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
            throw Object.assign(new Error("Cantitatea sau produsul din coș nu este valid."), { status: 400 });
        }
        const nextQuantity = (quantities.get(productId) ?? 0) + quantity;
        if (nextQuantity > 99) {
            throw Object.assign(new Error("Cantitatea maximă pentru un produs este 99."), { status: 400 });
        }
        quantities.set(productId, nextQuantity);
    }

    const findProduct = db.prepare("SELECT id, name, slug, price, image_url AS imageUrl FROM products WHERE id = ?");
    const quoteItems = Array.from(quantities, ([productId, quantity]) => {
        const product = findProduct.get(productId);
        if (!product) {
            throw Object.assign(new Error("Unul dintre produsele din coș nu mai este disponibil."), { status: 404 });
        }
        return { ...product, price: Number(product.price), quantity, lineTotal: roundMoney(Number(product.price) * quantity) };
    });
    const subtotal = roundMoney(quoteItems.reduce((total, item) => total + item.lineTotal, 0));
    let coupon = null;
    let discount = 0;

    if (couponCode) {
        const normalizedCode = String(couponCode).trim().toUpperCase();
        const couponRow = db.prepare(`
            SELECT id, code, name, discount_type AS discountType, discount_value AS discountValue,
                   expires_at AS expiresAt, is_active AS isActive
            FROM coupons
            WHERE code = ? COLLATE NOCASE AND is_active = 1
              AND (expires_at IS NULL OR datetime(expires_at) >= datetime('now'))
        `).get(normalizedCode);
        if (!couponRow) {
            throw Object.assign(new Error("Codul de cupon nu este valid sau a expirat."), { status: 400 });
        }
        discount = couponRow.discountType === "percent"
            ? roundMoney(subtotal * Number(couponRow.discountValue) / 100)
            : roundMoney(Number(couponRow.discountValue));
        discount = Math.min(discount, subtotal);
        coupon = {
            id: Number(couponRow.id),
            code: couponRow.code,
            name: couponRow.name,
            discountType: couponRow.discountType,
            discountValue: Number(couponRow.discountValue),
        };
    }

    const shipping = subtotal >= 150 ? 0 : 20;
    return {
        items: quoteItems,
        subtotal,
        discount,
        shipping,
        total: roundMoney(Math.max(0, subtotal - discount) + shipping),
        coupon,
    };
}

function roundMoney(value) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
}

app.post("/api/cart/quote", jsonParser, (req, res) => {
    try {
        const quote = buildCartQuote(req.body?.items);
        if (req.body?.couponCode) {
            try {
                res.json(buildCartQuote(req.body.items, req.body.couponCode));
            } catch (error) {
                if (error.status === 400) {
                    return res.status(400).json({ error: error.message, quote });
                }
                throw error;
            }
            return;
        }
        res.json(quote);
    } catch (error) {
        if (error.status) {
            return res.status(error.status).json({ error: error.message });
        }
        console.error("Eroare la calcularea coșului:", error);
        res.status(500).json({ error: "Totalul coșului nu a putut fi calculat." });
    }
});

function normalizeProductInput(body) {
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const slug = typeof body?.slug === "string" && body.slug.trim()
        ? body.slug.trim().toLowerCase()
        : name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const price = Number(body?.price);
    const categoryId = body?.categoryId === "" || body?.categoryId === null ? null : Number(body?.categoryId);
    const description = typeof body?.description === "string" ? body.description.trim() : "";
    const imageUrl = typeof body?.imageUrl === "string" ? body.imageUrl.trim() : "";
    const images = Array.isArray(body?.images)
        ? body.images.filter((image) => typeof image === "string").map((image) => image.trim()).filter(Boolean)
        : [];
    const tags = Array.isArray(body?.tags)
        ? body.tags.filter((tag) => typeof tag === "string").map((tag) => tag.trim()).filter(Boolean)
        : [];

    if (!name || name.length > 160) throw new Error("Numele produsului este obligatoriu (maximum 160 de caractere).");
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 180) throw new Error("Slug-ul poate conține doar litere mici, cifre și cratime.");
    if (!Number.isFinite(price) || price < 0 || price > 1000000) throw new Error("Prețul introdus nu este valid.");
    if (description.length > 10000 || imageUrl.length > 2000) throw new Error("Descrierea sau imaginea depășește limita permisă.");
    if (categoryId !== null && (!Number.isInteger(categoryId) || !db.prepare("SELECT 1 FROM categories WHERE id = ?").get(categoryId))) {
        throw new Error("Categoria selectată nu există.");
    }
    if (images.length > 20 || images.some((image) => image.length > 2000) || tags.length > 30 || tags.some((tag) => tag.length > 80)) {
        throw new Error("Prea multe imagini sau etichete, ori un câmp depășește limita permisă.");
    }

    return {
        name,
        slug,
        price,
        categoryId,
        description,
        imageUrl,
        images: [...new Set([...(imageUrl ? [imageUrl] : []), ...images])],
        tags: [...new Set(tags)],
        isFeatured: body?.isFeatured === true,
    };
}

function replaceProductDetails(productId, product) {
    db.prepare("DELETE FROM product_images WHERE product_id = ?").run(productId);
    db.prepare("DELETE FROM product_tags WHERE product_id = ?").run(productId);
    const addImage = db.prepare("INSERT INTO product_images (product_id, image_url, is_main) VALUES (?, ?, ?)");
    product.images.forEach((image, index) => addImage.run(productId, image, index === 0 ? 1 : 0));
    const addTag = db.prepare("INSERT INTO product_tags (product_id, tag) VALUES (?, ?)");
    product.tags.forEach((tag) => addTag.run(productId, tag));
}

app.get("/api/admin/overview", requireOwner, (req, res) => {
    try {
        const stats = db.prepare(`
            SELECT
                (SELECT COUNT(*) FROM orders) AS orderCount,
                (SELECT COUNT(*) FROM orders WHERE status = 'pending') AS pendingOrders,
                (SELECT COUNT(*) FROM products) AS productCount,
                (SELECT COUNT(*) FROM users) AS userCount,
                COALESCE((SELECT SUM(total_price) FROM orders), 0) AS orderValue,
                COALESCE((SELECT SUM(total_price) FROM orders WHERE status = 'fulfilled'), 0) AS completedValue
        `).get();
        const recentOrders = db.prepare(`
            SELECT id, first_name AS firstName, last_name AS lastName, total_price AS totalPrice, status, created_at AS createdAt
            FROM orders ORDER BY created_at DESC, id DESC LIMIT 8
        `).all();
        res.json({ stats, recentOrders });
    } catch (error) {
        console.error("Eroare la încărcarea dashboardului:", error);
        res.status(500).json({ error: "Datele dashboardului nu au putut fi încărcate." });
    }
});

app.get("/api/admin/products", requireOwner, (req, res) => {
    try {
        const products = db.prepare(`
            SELECT p.id, p.name, p.slug, p.price, p.description, p.category_id AS categoryId,
                   c.name AS categoryName, p.image_url AS imageUrl, p.is_featured AS isFeatured
            FROM products p LEFT JOIN categories c ON c.id = p.category_id ORDER BY p.id DESC
        `).all().map((product) => ({
            ...product,
            isFeatured: Boolean(product.isFeatured),
            images: db.prepare("SELECT image_url FROM product_images WHERE product_id = ? ORDER BY is_main DESC, id").all(product.id).map((image) => image.image_url),
            tags: db.prepare("SELECT tag FROM product_tags WHERE product_id = ? ORDER BY tag").all(product.id).map((tag) => tag.tag),
        }));
        const categories = db.prepare("SELECT id, name, image_url AS imageUrl FROM categories ORDER BY name").all();
        res.json({ products, categories });
    } catch (error) {
        console.error("Eroare la încărcarea produselor pentru dashboard:", error);
        res.status(500).json({ error: "Produsele nu au putut fi încărcate." });
    }
});

app.post("/api/admin/categories", requireOwner, jsonParser, (req, res) => {
    const name = typeof req.body?.name === "string" ? req.body.name.trim().replace(/\s+/g, " ") : "";
    const imageUrl = typeof req.body?.imageUrl === "string" ? req.body.imageUrl.trim() : "";
    if (!name || name.length > 100) {
        return res.status(400).json({ error: "Numele categoriei este obligatoriu (maximum 100 de caractere)." });
    }
    if (imageUrl.length > 2000) return res.status(400).json({ error: "Adresa imaginii este prea lungă." });
    const slug = name
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
    if (!slug) return res.status(400).json({ error: "Numele categoriei trebuie să conțină litere sau cifre." });

    try {
        const result = db.prepare("INSERT INTO categories (name, slug, image_url) VALUES (?, ?, ?)").run(name, slug, imageUrl || null);
        res.status(201).json({ id: Number(result.lastInsertRowid), name, slug, imageUrl: imageUrl || null });
    } catch (error) {
        if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
            return res.status(409).json({ error: "Există deja o categorie cu acest nume sau slug." });
        }
        console.error("Eroare la crearea categoriei:", error);
        res.status(500).json({ error: "Categoria nu a putut fi creată." });
    }
});

app.post("/api/admin/categories/images", requireOwner, (req, res, next) => {
    categoryImageUpload.single("image")(req, res, (error) => {
        if (error) {
            const status = error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE" ? 413 : 400;
            return res.status(status).json({
                error: status === 413 ? "Imaginea trebuie să aibă maximum 8 MB." : error.message || "Imaginea nu a putut fi încărcată.",
            });
        }
        next();
    });
}, (req, res) => {
    if (!req.file) return res.status(400).json({ error: "Selectează o imagine." });
    res.status(201).json({ imageUrl: `uploads/categories/${req.file.filename}` });
});

app.patch("/api/admin/categories/:id", requireOwner, jsonParser, (req, res) => {
    const id = Number(req.params.id);
    const name = typeof req.body?.name === "string" ? req.body.name.trim().replace(/\s+/g, " ") : "";
    const imageUrl = typeof req.body?.imageUrl === "string" ? req.body.imageUrl.trim() : null;
    if (!Number.isInteger(id) || id < 1 || !name || name.length > 100 || imageUrl !== null && imageUrl.length > 2000) {
        return res.status(400).json({ error: "Datele categoriei nu sunt valide." });
    }
    try {
        const result = db.prepare("UPDATE categories SET name = ?, image_url = ? WHERE id = ?").run(name, imageUrl || null, id);
        if (!result.changes) return res.status(404).json({ error: "Categoria nu a fost găsită." });
        const category = db.prepare("SELECT id, name, slug, image_url AS imageUrl FROM categories WHERE id = ?").get(id);
        res.json(category);
    } catch (error) {
        console.error("Eroare la actualizarea categoriei:", error);
        res.status(500).json({ error: "Categoria nu a putut fi actualizată." });
    }
});

app.get("/api/admin/coupons", requireOwner, (req, res) => {
    try {
        const coupons = db.prepare(`
            SELECT id, code, name, discount_type AS discountType, discount_value AS discountValue,
                   expires_at AS expiresAt, is_active AS isActive, created_at AS createdAt
            FROM coupons ORDER BY created_at DESC, id DESC
        `).all().map((coupon) => ({ ...coupon, isActive: Boolean(coupon.isActive), discountValue: Number(coupon.discountValue) }));
        res.json(coupons);
    } catch (error) {
        console.error("Eroare la încărcarea cupoanelor:", error);
        res.status(500).json({ error: "Cupoanele nu au putut fi încărcate." });
    }
});

function normalizeCoupon(body) {
    const code = typeof body?.code === "string" ? body.code.trim().toUpperCase() : "";
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const discountType = body?.discountType;
    const discountValue = Number(body?.discountValue);
    const expiresAt = typeof body?.expiresAt === "string" && body.expiresAt.trim() ? body.expiresAt.trim() : null;
    const isActive = body?.isActive !== false;
    if (!/^[A-Z0-9_-]{3,40}$/.test(code) || !name || name.length > 100) {
        throw new Error("Codul (3–40 caractere) și numele cuponului sunt obligatorii.");
    }
    if (!["fixed", "percent"].includes(discountType) || !Number.isFinite(discountValue) || discountValue <= 0
        || discountType === "percent" && discountValue > 100 || discountType === "fixed" && discountValue > 1000000) {
        throw new Error("Valoarea sau tipul reducerii nu este valid.");
    }
    if (expiresAt && (!Number.isFinite(Date.parse(expiresAt)) || isActive && Date.parse(expiresAt) <= Date.now())) {
        throw new Error("Data expirării trebuie să fie în viitor.");
    }
    return { code, name, discountType, discountValue, expiresAt, isActive };
}

app.post("/api/admin/coupons", requireOwner, jsonParser, (req, res) => {
    try {
        const coupon = normalizeCoupon(req.body);
        const result = db.prepare(`
            INSERT INTO coupons (code, name, discount_type, discount_value, expires_at, is_active)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(coupon.code, coupon.name, coupon.discountType, coupon.discountValue, coupon.expiresAt, coupon.isActive ? 1 : 0);
        res.status(201).json({ id: Number(result.lastInsertRowid), ...coupon });
    } catch (error) {
        if (error.code === "SQLITE_CONSTRAINT_UNIQUE") return res.status(409).json({ error: "Există deja un cupon cu acest cod." });
        if (error.message) return res.status(400).json({ error: error.message });
        console.error("Eroare la crearea cuponului:", error);
        res.status(500).json({ error: "Cuponul nu a putut fi creat." });
    }
});

app.patch("/api/admin/coupons/:id", requireOwner, jsonParser, (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: "Cuponul nu este valid." });
    try {
        const coupon = normalizeCoupon(req.body);
        const result = db.prepare(`
            UPDATE coupons SET code = ?, name = ?, discount_type = ?, discount_value = ?, expires_at = ?, is_active = ?
            WHERE id = ?
        `).run(coupon.code, coupon.name, coupon.discountType, coupon.discountValue, coupon.expiresAt, coupon.isActive ? 1 : 0, id);
        if (!result.changes) return res.status(404).json({ error: "Cuponul nu a fost găsit." });
        res.json({ id, ...coupon });
    } catch (error) {
        if (error.code === "SQLITE_CONSTRAINT_UNIQUE") return res.status(409).json({ error: "Există deja un cupon cu acest cod." });
        if (error.message) return res.status(400).json({ error: error.message });
        console.error("Eroare la actualizarea cuponului:", error);
        res.status(500).json({ error: "Cuponul nu a putut fi actualizat." });
    }
});

app.delete("/api/admin/coupons/:id", requireOwner, (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: "Cuponul nu este valid." });
    try {
        const result = db.prepare("DELETE FROM coupons WHERE id = ?").run(id);
        if (!result.changes) return res.status(404).json({ error: "Cuponul nu a fost găsit." });
        res.sendStatus(204);
    } catch (error) {
        console.error("Eroare la ștergerea cuponului:", error);
        res.status(500).json({ error: "Cuponul nu a putut fi șters." });
    }
});

app.post("/api/admin/products/images", requireOwner, (req, res, next) => {
    productImageUpload.array("images", 12)(req, res, (error) => {
        if (error) {
            const status = error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE" ? 413 : 400;
            return res.status(status).json({
                error: status === 413
                    ? "Fiecare imagine trebuie să aibă maximum 8 MB."
                    : error.message || "Imaginile nu au putut fi încărcate.",
            });
        }
        next();
    });
}, (req, res) => {
    const files = req.files;
    if (!Array.isArray(files) || files.length === 0) {
        return res.status(400).json({ error: "Selectează cel puțin o imagine." });
    }
    res.status(201).json({
        images: files.map((file) => `uploads/products/${file.filename}`),
    });
});

app.post("/api/admin/products", requireOwner, jsonParser, (req, res) => {
    try {
        const product = normalizeProductInput(req.body);
        const createProduct = db.transaction(() => {
            const result = db.prepare(`
                INSERT INTO products (name, slug, price, description, category_id, image_url, is_featured)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `).run(product.name, product.slug, product.price, product.description, product.categoryId, product.imageUrl || null, product.isFeatured ? 1 : 0);
            const id = Number(result.lastInsertRowid);
            replaceProductDetails(id, product);
            return id;
        });
        res.status(201).json({ id: createProduct() });
    } catch (error) {
        if (error.code === "SQLITE_CONSTRAINT_UNIQUE") return res.status(409).json({ error: "Există deja un produs cu acest slug." });
        if (error.code === undefined && error.message) return res.status(400).json({ error: error.message });
        console.error("Eroare la crearea produsului:", error);
        res.status(500).json({ error: "Produsul nu a putut fi creat." });
    }
});

app.patch("/api/admin/products/:id", requireOwner, jsonParser, (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: "Identificator de produs invalid." });
    try {
        const product = normalizeProductInput(req.body);
        const updateProduct = db.transaction(() => {
            const result = db.prepare(`
                UPDATE products SET name = ?, slug = ?, price = ?, description = ?, category_id = ?, image_url = ?, is_featured = ?
                WHERE id = ?
            `).run(product.name, product.slug, product.price, product.description, product.categoryId, product.imageUrl || null, product.isFeatured ? 1 : 0, id);
            if (!result.changes) return false;
            replaceProductDetails(id, product);
            return true;
        });
        if (!updateProduct()) return res.status(404).json({ error: "Produsul nu a fost găsit." });
        res.json({ success: true });
    } catch (error) {
        if (error.code === "SQLITE_CONSTRAINT_UNIQUE") return res.status(409).json({ error: "Există deja un produs cu acest slug." });
        if (error.code === undefined && error.message) return res.status(400).json({ error: error.message });
        console.error("Eroare la actualizarea produsului:", error);
        res.status(500).json({ error: "Produsul nu a putut fi actualizat." });
    }
});

app.delete("/api/admin/products/:id", requireOwner, (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: "Identificator de produs invalid." });
    try {
        const result = db.prepare("DELETE FROM products WHERE id = ?").run(id);
        if (!result.changes) return res.status(404).json({ error: "Produsul nu a fost găsit." });
        res.json({ success: true });
    } catch (error) {
        console.error("Eroare la ștergerea produsului:", error);
        res.status(500).json({ error: "Produsul nu a putut fi șters." });
    }
});

app.get("/api/admin/users", requireOwner, (req, res) => {
    try {
        const users = db.prepare(`
            SELECT u.id, u.first_name AS firstName, u.last_name AS lastName, u.email, u.phone,
                   u.role, u.created_at AS createdAt, COUNT(o.id) AS orderCount
            FROM users u LEFT JOIN orders o ON o.user_id = u.id
            GROUP BY u.id ORDER BY u.created_at DESC, u.id DESC
        `).all();
        res.json(users);
    } catch (error) {
        console.error("Eroare la încărcarea utilizatorilor:", error);
        res.status(500).json({ error: "Utilizatorii nu au putut fi încărcați." });
    }
});

app.patch("/api/admin/users/:id/role", requireOwner, jsonParser, (req, res) => {
    const id = Number(req.params.id);
    const role = req.body?.role;
    if (!Number.isInteger(id) || id < 1 || !["user", "owner"].includes(role)) {
        return res.status(400).json({ error: "Utilizator sau rol invalid." });
    }
    if (id === req.authenticatedUser.id && role !== "owner") {
        return res.status(409).json({ error: "Nu îți poți elimina propriul rol de owner din dashboard." });
    }
    try {
        const updateRole = db.transaction(() => {
            const target = db.prepare("SELECT role FROM users WHERE id = ?").get(id);
            if (!target) return "missing";
            if (target.role === "owner" && role !== "owner" && db.prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'owner'").get().count <= 1) {
                return "last-owner";
            }
            db.prepare("UPDATE users SET role = ? WHERE id = ?").run(role, id);
            return "updated";
        });
        const result = updateRole();
        if (result === "missing") return res.status(404).json({ error: "Utilizatorul nu a fost găsit." });
        if (result === "last-owner") return res.status(409).json({ error: "Nu poți elimina rolul ultimului owner." });
        res.json({ success: true });
    } catch (error) {
        console.error("Eroare la actualizarea rolului:", error);
        res.status(500).json({ error: "Rolul utilizatorului nu a putut fi actualizat." });
    }
});

app.delete("/api/admin/users/:id", requireOwner, (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: "Identificator de utilizator invalid." });
    try {
        const removeUser = db.transaction(() => {
            if (id === req.authenticatedUser.id) return "self";
            const target = db.prepare("SELECT role FROM users WHERE id = ?").get(id);
            if (!target) return "missing";
            if (target.role === "owner" && db.prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'owner'").get().count <= 1) {
                return "last-owner";
            }
            db.prepare("DELETE FROM users WHERE id = ?").run(id);
            return "deleted";
        });
        const result = removeUser();
        if (result === "self") return res.status(409).json({ error: "Nu îți poți șterge propriul cont din dashboard." });
        if (result === "missing") return res.status(404).json({ error: "Utilizatorul nu a fost găsit." });
        if (result === "last-owner") return res.status(409).json({ error: "Nu poți șterge ultimul owner." });
        res.json({ success: true });
    } catch (error) {
        console.error("Eroare la ștergerea utilizatorului:", error);
        res.status(500).json({ error: "Utilizatorul nu a putut fi șters." });
    }
});

app.get("/api/admin/orders", requireOwner, (req, res) => {
    try {
        const orders = db.prepare(`
            SELECT id, user_id AS userId, first_name AS firstName, last_name AS lastName, email, phone,
                   shipping_address AS shippingAddress, total_price AS totalPrice, status, created_at AS createdAt
            FROM orders ORDER BY created_at DESC, id DESC
        `).all().map((order) => ({
            ...order,
            items: db.prepare(`
                SELECT product_name AS productName, color, infill, scale_pct AS scalePct, quantity, price
                FROM order_items WHERE order_id = ? ORDER BY id
            `).all(order.id),
        }));
        res.json(orders);
    } catch (error) {
        console.error("Eroare la încărcarea comenzilor:", error);
        res.status(500).json({ error: "Comenzile nu au putut fi încărcate." });
    }
});

app.patch("/api/admin/orders/:id/status", requireOwner, jsonParser, (req, res) => {
    const id = Number(req.params.id);
    const status = req.body?.status;
    if (!Number.isInteger(id) || id < 1 || !["pending", "processing", "fulfilled", "cancelled"].includes(status)) {
        return res.status(400).json({ error: "Comandă sau status invalid." });
    }
    try {
        const result = db.prepare("UPDATE orders SET status = ? WHERE id = ?").run(status, id);
        if (!result.changes) return res.status(404).json({ error: "Comanda nu a fost găsită." });
        res.json({ success: true });
    } catch (error) {
        console.error("Eroare la actualizarea statusului comenzii:", error);
        res.status(500).json({ error: "Statusul comenzii nu a putut fi actualizat." });
    }
});

app.listen(PORT, () => {
    console.log(`Nexus3D API activ la http://localhost:${PORT}`);
});