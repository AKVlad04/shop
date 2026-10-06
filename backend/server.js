
import express from "express";
import dotenv from "dotenv";
import multer from "multer";
import fs from "fs";
import path from "path";
import * as THREE from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";

dotenv.config();

const app = express();

// Data directories
// For Render persistent disk, set NEXUS3D_DATA_DIR=/var/data (and mount a disk there).
const DATA_DIR = (typeof process.env.NEXUS3D_DATA_DIR === "string" && process.env.NEXUS3D_DATA_DIR.length)
    ? process.env.NEXUS3D_DATA_DIR
    : process.cwd();
const UPLOADS_DIR = path.join(DATA_DIR, "uploads");
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

// 1. Asigurăm existența folderelor
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(COMENZI_DIR)) fs.mkdirSync(COMENZI_DIR, { recursive: true });

app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Content-Type");
    res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    if (req.method === "OPTIONS") return res.sendStatus(200);
    next();
});

app.get("/health", (req, res) => {
    res.json({ ok: true, service: "nexus3d-backend", multiFile: true, date: "2026-02-04" });
});

function getEnv(name, fallback = undefined) {
    const v = process.env[name];
    return (typeof v === "string" && v.length) ? v : fallback;
}

const _shopifyTokenCache = {
    token: null,
    expiresAtMs: 0,
    scope: null,
};

async function getShopifyAdminAccessToken() {
    // Backward compatible: allow a static token.
    const staticToken = getEnv("SHOPIFY_ADMIN_ACCESS_TOKEN");
    if (staticToken) return staticToken;

    const storeDomain = getEnv("SHOPIFY_STORE_DOMAIN");
    const clientId = getEnv("SHOPIFY_CLIENT_ID");
    const clientSecret = getEnv("SHOPIFY_CLIENT_SECRET");

    if (!storeDomain || !clientId || !clientSecret) {
        const err = new Error(
            "Missing Shopify config. Set SHOPIFY_STORE_DOMAIN and either SHOPIFY_ADMIN_ACCESS_TOKEN, or (SHOPIFY_CLIENT_ID + SHOPIFY_CLIENT_SECRET)."
        );
        err.code = "SHOPIFY_CONFIG_MISSING";
        throw err;
    }

    const now = Date.now();
    if (_shopifyTokenCache.token && _shopifyTokenCache.expiresAtMs && now < _shopifyTokenCache.expiresAtMs) {
        return _shopifyTokenCache.token;
    }

    const tokenUrl = `https://${storeDomain}/admin/oauth/access_token`;
    const form = new URLSearchParams();
    form.set("grant_type", "client_credentials");
    form.set("client_id", clientId);
    form.set("client_secret", clientSecret);

    const res = await fetch(tokenUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: form.toString(),
    });

    const text = await res.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch { json = null; }

    if (!res.ok) {
        const msg = (json && (json.error_description || json.error)) ? (json.error_description || json.error) : text;
        const err = new Error(`Shopify token error (${res.status}): ${msg || res.statusText}`);
        err.status = res.status;
        err.details = json;
        throw err;
    }

    const accessToken = json?.access_token;
    const expiresIn = Number(json?.expires_in);
    if (!accessToken) throw new Error("Shopify token response missing access_token");

    const refreshEarlyMs = 60 * 1000;
    const ttlMs = (isFinite(expiresIn) && expiresIn > 0) ? (expiresIn * 1000) : (24 * 60 * 60 * 1000);
    _shopifyTokenCache.token = accessToken;
    _shopifyTokenCache.scope = json?.scope || null;
    _shopifyTokenCache.expiresAtMs = Date.now() + Math.max(0, ttlMs - refreshEarlyMs);

    return accessToken;
}

async function shopifyAdminRequest(pathname, { method = "GET", body } = {}) {
    const storeDomain = getEnv("SHOPIFY_STORE_DOMAIN"); // e.g. your-store.myshopify.com
    const apiVersion = getEnv("SHOPIFY_API_VERSION", "2024-10");

    if (!storeDomain) {
        const err = new Error("Missing Shopify config: set SHOPIFY_STORE_DOMAIN");
        err.code = "SHOPIFY_CONFIG_MISSING";
        throw err;
    }

    const token = await getShopifyAdminAccessToken();

    const url = `https://${storeDomain}/admin/api/${apiVersion}/${pathname.replace(/^\/+/, "")}`;
    const res = await fetch(url, {
        method,
        headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "X-Shopify-Access-Token": token,
        },
        body: body ? JSON.stringify(body) : undefined,
    });

    const text = await res.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch { json = null; }

    if (!res.ok) {
        const msg = (json && (json.errors || json.error)) ? JSON.stringify(json.errors || json.error) : text;
        const err = new Error(`Shopify Admin API error (${res.status}): ${msg || res.statusText}`);
        err.status = res.status;
        err.details = json;
        throw err;
    }
    return json;
}

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

    if (!offerText || !files || files.length === 0) {
        return res.status(400).json({ success: false, msg: "Date incomplete" });
    }

    try {
        const saved = saveOrderToDisk({ offerText, files });

        console.log(`✅ Comandă nouă salvată în: ${saved.orderPath}`);
        console.log(
            `   ↳ Transform exports: ${saved.transformedCount}/${files.length}, assembly: ${saved.assemblyWritten ? "yes" : "no"}, meta: ${EXPORT_OPTS.writeMeta ? "yes" : "no"}`
        );
        console.log(
            `   ↳ Export opts: overwriteOriginal=${EXPORT_OPTS.overwriteOriginal ? "1" : "0"}, keepOrig=${EXPORT_OPTS.keepOrigBackup ? "1" : "0"}, separateTransformed=${EXPORT_OPTS.writeSeparateTransformed ? "1" : "0"}, assembly=${EXPORT_OPTS.writeAssembly ? "1" : "0"}`
        );
        res.json({ success: true, msg: "Comanda a fost înregistrată cu succes!", transformedCount: saved.transformedCount, fileCount: saved.fileCount, assemblyWritten: saved.assemblyWritten });

    } catch (err) {
        console.error("Eroare la salvare comandă:", err);
        res.status(500).json({ success: false, msg: "Eroare server la salvare." });
    }
});

// --- ENDPOINT 3: SHOPIFY DRAFT ORDER + CHECKOUT URL ---
// This creates a Draft Order (custom price) in Shopify and returns an invoice URL.
// Requires env vars:
// - SHOPIFY_STORE_DOMAIN=your-store.myshopify.com
// - SHOPIFY_ADMIN_ACCESS_TOKEN=shpat_...
// Optional:
// - SHOPIFY_API_VERSION=2024-10
app.post("/shopify/draft-order", jsonParser, async (req, res) => {
    let body = req.body;
    if (typeof body === "string") {
        try { body = JSON.parse(body); } catch { body = {}; }
    }

    const offerText = body?.offerText;
    const files = normalizeFilesFromBody(body);
    const amountLei = Number(body?.amountLei ?? body?.amount ?? body?.quote?.totalRounded);
    const customerEmail = (typeof body?.customerEmail === "string" && body.customerEmail.includes("@")) ? body.customerEmail : undefined;

    if (!offerText || !files.length) {
        return res.status(400).json({ success: false, error: "Date incomplete (offerText/files)" });
    }
    if (!isFinite(amountLei) || amountLei <= 0) {
        return res.status(400).json({ success: false, error: "Suma invalidă" });
    }

    try {
        // Save a local copy of the order details + STL(s)
        const saved = saveOrderToDisk({ offerText, files });

        const fileNames = files.map((f) => f.serverFileName).slice(0, 20).join(", ");
        const payload = {
            draft_order: {
                line_items: [
                    {
                        title: "Print 3D personalizat",
                        quantity: 1,
                        price: String(Math.round(amountLei)),
                        properties: [
                            { name: "Culoare", value: body?.color || body?.selectedColor?.name || "" },
                            { name: "Infill", value: body?.infill ? `${body.infill}%` : (body?.selectedInfill ? `${body.selectedInfill}%` : "") },
                            { name: "Scalare", value: body?.scalePct ? `${body.scalePct}%` : "" },
                            { name: "Fișiere", value: fileNames },
                            { name: "Folder server", value: saved.orderFolderName },
                        ].filter((p) => p.value),
                    },
                ],
                note: offerText,
                tags: "estimator,3dprint",
                note_attributes: [
                    { name: "OrderFolder", value: saved.orderFolderName },
                    { name: "FileCount", value: String(saved.fileCount) },
                    { name: "TransformedCount", value: String(saved.transformedCount) },
                ],
            },
        };

        if (customerEmail) {
            payload.draft_order.email = customerEmail;
        }

        const created = await shopifyAdminRequest("draft_orders.json", { method: "POST", body: payload });
        const draftOrder = created?.draft_order;
        const checkoutUrl = draftOrder?.invoice_url || draftOrder?.checkout_url;

        if (!checkoutUrl) {
            return res.status(502).json({ success: false, error: "Draft order created but no checkout URL returned", draftOrder });
        }

        res.json({
            success: true,
            checkoutUrl,
            draftOrderId: draftOrder?.id,
            draftOrderName: draftOrder?.name,
            orderFolder: saved.orderFolderName,
        });
    } catch (err) {
        console.error("Eroare Shopify draft order:", err);
        const status = err?.code === "SHOPIFY_CONFIG_MISSING" ? 500 : 502;
        res.status(status).json({ success: false, error: err?.message || "Eroare Shopify" });
    }
});

const PORT = Number(process.env.PORT) || 5000;

app.listen(PORT, () => {
    console.log(`Nexus3D API activ la http://localhost:${PORT}`);
});