import Database from 'better-sqlite3';

const db = new Database('shop.db', { verbose: console.log });
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'user',
    terms_accepted_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS user_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at);

  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    image_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS coupons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE COLLATE NOCASE,
    name TEXT NOT NULL,
    discount_type TEXT NOT NULL CHECK (discount_type IN ('fixed', 'percent')),
    discount_value REAL NOT NULL CHECK (discount_value > 0),
    expires_at DATETIME,
    is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    price REAL NOT NULL,
    description TEXT,
    category_id INTEGER REFERENCES categories(id),
    image_url TEXT,
    is_featured BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS product_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    image_url TEXT NOT NULL,
    is_main BOOLEAN DEFAULT 0, -- Să știm care poză este coperta principală
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS product_tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    tag TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (product_id, tag),
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS wishlist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    guest_token TEXT,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    shipping_address TEXT NOT NULL,
    total_price REAL NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    product_name TEXT NOT NULL,
    color TEXT,
    infill INTEGER,
    scale_pct REAL,
    quantity INTEGER DEFAULT 1,
    price REAL NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
  );
`);

const categoryColumns = db.pragma('table_info(categories)');
if (!categoryColumns.some(column => column.name === 'image_url')) {
  db.exec('ALTER TABLE categories ADD COLUMN image_url TEXT');
}

const userColumns = db.pragma('table_info(users)');
if (!userColumns.some(column => column.name === 'terms_accepted_at')) {
  db.exec('ALTER TABLE users ADD COLUMN terms_accepted_at DATETIME');
}

const productColumns = db.pragma('table_info(products)');
if (!productColumns.some(column => column.name === 'category_id')) {
  db.exec('ALTER TABLE products ADD COLUMN category_id INTEGER REFERENCES categories(id)');
}

const mockCategories = [
  { name: 'Standuri', slug: 'standuri' },
  { name: 'Brelocuri', slug: 'keychains' },
];

const insertCategory = db.prepare(
  'INSERT OR IGNORE INTO categories (name, slug) VALUES (?, ?)'
);
const findCategoryId = db.prepare('SELECT id FROM categories WHERE slug = ?');
const categoryIdForSlug = new Map();

for (const category of mockCategories) {
  insertCategory.run(category.name, category.slug);
  categoryIdForSlug.set(category.slug, findCategoryId.get(category.slug).id);
}

const slugifyCategory = value => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '');

if (productColumns.some(column => column.name === 'category')) {
  const legacyCategories = db.prepare(
    'SELECT DISTINCT category FROM products WHERE category IS NOT NULL AND TRIM(category) != ?'
  ).all('');
  const migrateCategory = db.prepare(
    'UPDATE products SET category_id = ? WHERE category_id IS NULL AND category = ?'
  );

  for (const { category: legacyName } of legacyCategories) {
    const slug = slugifyCategory(legacyName);
    if (!slug) continue;
    insertCategory.run(legacyName, slug);
    const categoryId = findCategoryId.get(slug).id;
    categoryIdForSlug.set(slug, categoryId);
    migrateCategory.run(categoryId, legacyName);
  }
}

insertCategory.run('Altele', 'altele');
const fallbackCategoryId = findCategoryId.get('altele').id;
db.prepare('UPDATE products SET category_id = ? WHERE category_id IS NULL')
  .run(fallbackCategoryId);

// Inserăm câteva produse de test dacă tabela este goală
const productCount = db.prepare('SELECT COUNT(*) as count FROM products').get().count;
if (productCount === 0) {
  const insert = db.prepare(`
    INSERT INTO products (name, slug, price, description, category_id, image_url, is_featured) 
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  insert.run('Suport Căști Minimalist', 'suport-casti-minimalist', 45.00, 'Suport robust și elegant...', categoryIdForSlug.get('standuri'), 'uploads/products/1.jpg', 1);
  insert.run('Suport Controller', 'suport-controller', 35.00, 'Suport compatibil cu controllere...', categoryIdForSlug.get('standuri'), 'uploads/products/2.jpg', 1);
  insert.run('Breloc Personalizat 3D', 'breloc-personalizat-3d', 15.00, 'Breloc ușor și rezistent...', categoryIdForSlug.get('keychains'), 'uploads/products/3.jpg', 0);
  insert.run('Suport', 'suport', 35.00, 'Suport compatibil cu controllere...', categoryIdForSlug.get('standuri'), 'uploads/products/4.jpg', 1);
  insert.run('Breloc', 'breloc', 15.00, 'Breloc ușor și rezistent...', categoryIdForSlug.get('keychains'), 'uploads/products/5.jpg', 0);
  console.log("Produsele de test au fost adăugate în baza de date!");
}

const mockProductImages = [
  {
    slug: 'suport-casti-minimalist',
    images: ['uploads/products/6.jpg', 'uploads/products/7.jpg', 'uploads/products/8.jpg'],
  },
  {
    slug: 'suport-controller',
    images: ['uploads/products/9.jpg', 'uploads/products/10.jpg', 'uploads/products/11.jpg'],
  },
  {
    slug: 'breloc-personalizat-3d',
    images: ['uploads/products/12.jpg', 'uploads/products/13.jpg', 'uploads/products/14.jpg'],
  },
    {
    slug: 'suport',
    images: ['uploads/products/15.jpg', 'uploads/products/16.jpg', 'uploads/products/17.jpg'],
  },
  {
    slug: 'breloc',
    images: ['uploads/products/18.jpg', 'uploads/products/19.jpg', 'uploads/products/20.jpg'],
  },
];

const findProductId = db.prepare('SELECT id FROM products WHERE slug = ?');
const countProductImages = db.prepare('SELECT COUNT(*) AS count FROM product_images WHERE product_id = ?');
const insertProductImage = db.prepare(
  'INSERT INTO product_images (product_id, image_url, is_main) VALUES (?, ?, ?)'
);

const seedProductImages = db.transaction(() => {
  for (const mockProduct of mockProductImages) {
    const product = findProductId.get(mockProduct.slug);
    if (!product || countProductImages.get(product.id).count > 0) continue;

    mockProduct.images.forEach((imageUrl, index) => {
      insertProductImage.run(product.id, imageUrl, index === 0 ? 1 : 0);
    });
  }
});

seedProductImages();

const mockProductTags = [
  {
    slug: 'suport-casti-minimalist',
    tags: ['birou', 'gaming', 'căști', 'setup', 'organizare'],
  },
  {
    slug: 'suport-controller',
    tags: ['birou', 'gaming', 'controller', 'suport controller', 'organizare'],
  },
  {
    slug: 'breloc-personalizat-3d',
    tags: ['cadou', 'personalizat', 'breloc', 'chei', 'accesorii'],
  },
];

const insertProductTag = db.prepare(
  'INSERT OR IGNORE INTO product_tags (product_id, tag) VALUES (?, ?)'
);

const seedProductTags = db.transaction(() => {
  for (const mockProduct of mockProductTags) {
    const product = findProductId.get(mockProduct.slug);
    if (!product) continue;

    for (const tag of mockProduct.tags) {
      insertProductTag.run(product.id, tag);
    }
  }
});

seedProductTags();

console.log("Baza de date avansată a fost configurată cu succes!");

export default db;