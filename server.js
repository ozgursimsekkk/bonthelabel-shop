const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const app = express();
const db = new Database('./shop.db');

const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const storage = multer.diskStorage({ destination: uploadDir, filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname) });
const upload = multer({ storage });

db.exec(`CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, description TEXT,
  price REAL NOT NULL, compare_price REAL, image TEXT, category TEXT,
  sizes TEXT DEFAULT 'XS,S,M,L,XL', colors TEXT DEFAULT 'Black,White,Beige',
  sku TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

const cnt = db.prepare('SELECT COUNT(*) as c FROM products').get();
if (cnt.c === 0) {
  const ins = db.prepare('INSERT INTO products (name, description, price, compare_price, image, category, sizes, colors, sku) VALUES (?,?,?,?,?,?,?,?,?)');
  ins.run('Silk Evening Dress', 'Elegant floor-length silk dress, perfect for special occasions. Crafted from 100% pure silk charmeuse, this gown drapes beautifully and moves with the body. Features a subtle V-neckline, delicate spaghetti straps, and an invisible back zipper.', 189.00, 240.00, null, 'Dresses', 'XS,S,M,L,XL', 'Black,Ivory,Dusty Rose', 'ELD-001');
  ins.run('Floral Wrap Dress', 'Feminine wrap dress with a delicate floral print. The adjustable waist tie creates a flattering silhouette on all body types. Made from lightweight viscose for all-day comfort.', 89.00, 120.00, null, 'Dresses', 'XS,S,M,L,XL,XXL', 'Floral Blue,Floral Pink,Floral Green', 'FWD-002');
  ins.run('Linen Summer Dress', 'Casual yet chic linen dress for warm days. Relaxed silhouette with side pockets and a tie detail at the waist. 100% European linen.', 75.00, null, null, 'Dresses', 'S,M,L,XL', 'Sand,Sage,White', 'LSD-003');
  ins.run('Knit Midi Dress', 'Cozy ribbed knit midi dress with long sleeves. A wardrobe staple for transitional seasons. Stretchy fabric ensures a comfortable fit.', 110.00, 145.00, null, 'Dresses', 'XS,S,M,L', 'Camel,Cream,Charcoal', 'KMD-004');
  ins.run('Mini Cocktail Dress', 'Sleek mini dress with subtle shimmer thread woven throughout. A bodycon silhouette that flatters every curve. Goes effortlessly from day to night.', 135.00, 180.00, null, 'Dresses', 'XS,S,M,L', 'Black,Champagne,Midnight Blue', 'MCD-005');
  ins.run('Boho Maxi Dress', 'Free-spirited maxi dress with tiered skirt and hand-embroidered details at the neckline. Made from sustainable organic cotton.', 95.00, null, null, 'Dresses', 'S,M,L,XL,XXL', 'Terracotta,Off White,Denim Blue', 'BMD-006');
}

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));

app.get('/', (req, res) => { const products = db.prepare('SELECT * FROM products ORDER BY created_at DESC').all(); res.send(renderHome(products)); });
app.get('/collections', (req, res) => {
  const { cat, sort, min, max } = req.query;
  let q = 'SELECT * FROM products WHERE 1=1';
  const params = [];
  if (cat) { q += ' AND category = ?'; params.push(cat); }
  if (min) { q += ' AND price >= ?'; params.push(parseFloat(min)); }
  if (max) { q += ' AND price <= ?'; params.push(parseFloat(max)); }
  if (sort === 'price_asc') q += ' ORDER BY price ASC';
  else if (sort === 'price_desc') q += ' ORDER BY price DESC';
  else q += ' ORDER BY created_at DESC';
  const products = db.prepare(q).all(...params);
  res.send(renderCollection(products, req.query));
});
app.get('/product/:id', (req, res) => {
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!product) return res.redirect('/collections');
  const related = db.prepare('SELECT * FROM products WHERE id != ? LIMIT 4').all(req.params.id);
  res.send(renderProduct(product, related));
});
app.get('/cart', (req, res) => res.send(renderCart()));
app.get('/checkout', (req, res) => res.send(renderCheckout()));
app.post('/checkout', (req, res) => res.send(renderCheckoutError()));
app.get('/privacy-policy', (req, res) => res.send(renderPolicy('Privacy Policy', privacyContent)));
app.get('/refund-policy', (req, res) => res.send(renderPolicy('Refund Policy', refundContent)));
app.get('/terms-of-service', (req, res) => res.send(renderPolicy('Terms of Service', termsContent)));
app.get('/contact', (req, res) => res.send(renderPolicy('Contact Us', contactContent)));
app.get('/about', (req, res) => res.send(renderPolicy('Our Story', aboutContent)));
app.get('/shipping', (req, res) => res.send(renderPolicy('Shipping & Delivery', shippingContent)));
app.get('/tracking', (req, res) => res.send(renderPolicy('Track Your Order', trackingContent)));
app.get('/faq', (req, res) => res.send(renderPolicy('FAQ', faqContent)));
app.get('/admin', (req, res) => { const products = db.prepare('SELECT * FROM products ORDER BY created_at DESC').all(); res.send(renderAdmin(products)); });
app.post('/admin/add', upload.single('image'), (req, res) => {
  const { name, description, price, compare_price, category, sizes, colors, sku } = req.body;
  const image = req.file ? '/uploads/' + req.file.filename : null;
  db.prepare('INSERT INTO products (name, description, price, compare_price, image, category, sizes, colors, sku) VALUES (?,?,?,?,?,?,?,?,?)').run(name, description, parseFloat(price), compare_price ? parseFloat(compare_price) : null, image, category || 'Dresses', sizes || 'XS,S,M,L,XL', colors || 'Black,White', sku || null);
  res.redirect('/admin');
});
app.post('/admin/delete/:id', (req, res) => { db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id); res.redirect('/admin'); });

// ─── COLOR MAP ───
const colorHex = { 'Black':'#212121','White':'#fafafa','Ivory':'#fffff0','Beige':'#f5f0e8','Camel':'#c19a6b','Cream':'#fffdd0','Charcoal':'#4a4a4a','Sand':'#c2b280','Sage':'#87ae73','Terracotta':'#c66b3d','Dusty Rose':'#dcb4b0','Champagne':'#f7e7ce','Midnight Blue':'#1a237e','Off White':'#faf0e6','Denim Blue':'#1565c0','Floral Blue':'#4a90d9','Floral Pink':'#f06292','Floral Green':'#66bb6a','Nude':'#e8c9a0' };

// ─── SHARED STYLES ───
const sharedCSS = `
:root { --green:#008060; --text:#212121; --muted:#6d7175; --border:#e1e3e5; --bg:#f6f6f7; }
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:var(--text);background:#fff;font-size:14px}
a{text-decoration:none;color:inherit}
img{max-width:100%}
.btn-primary{display:inline-block;background:var(--green);color:#fff;padding:14px 28px;border:none;border-radius:4px;font-size:15px;font-weight:500;cursor:pointer;transition:background .2s;width:100%;text-align:center}
.btn-primary:hover{background:#006e52}
.btn-secondary{display:inline-block;background:#fff;color:var(--text);padding:13px 28px;border:1px solid var(--border);border-radius:4px;font-size:15px;font-weight:500;cursor:pointer;transition:all .2s;width:100%;text-align:center;margin-top:10px}
.btn-secondary:hover{background:var(--bg)}
/* NAV */
.shopify-nav{border-bottom:1px solid var(--border);background:#fff;position:sticky;top:0;z-index:200}
.nav-inner{max-width:1300px;margin:0 auto;padding:0 24px;height:56px;display:flex;align-items:center;justify-content:space-between}
.nav-logo{font-size:20px;font-weight:700;letter-spacing:3px;text-transform:uppercase}
.nav-links{display:flex;gap:28px;align-items:center}
.nav-links a{font-size:13px;color:var(--muted);transition:color .2s}
.nav-links a:hover{color:var(--text)}
.nav-actions{display:flex;gap:16px;align-items:center}
.nav-actions a{font-size:13px;color:var(--muted)}
.cart-link{position:relative}
.cart-badge{position:absolute;top:-6px;right:-8px;background:var(--green);color:#fff;font-size:10px;font-weight:700;width:16px;height:16px;border-radius:50%;display:flex;align-items:center;justify-content:center}
/* ANNOUNCEMENT */
.announcement{background:var(--text);color:#fff;text-align:center;padding:10px;font-size:13px;letter-spacing:.5px}
/* ─── MOBILE BASE ─── */
@media(max-width:768px){
  .nav-links{display:none}
  .nav-inner{padding:0 16px;height:50px}
  .nav-logo{font-size:17px;letter-spacing:2px}
  .announcement{font-size:11px;padding:7px 12px}
  .btn-primary,.btn-secondary{font-size:14px;padding:13px 20px}
  .hamburger{display:flex!important}
  .mobile-menu{display:block}
  .mobile-menu.open{display:flex}
}
.hamburger{display:none;flex-direction:column;gap:5px;cursor:pointer;padding:4px;background:none;border:none}
.hamburger span{width:22px;height:2px;background:var(--text);border-radius:2px;transition:.3s}
.mobile-menu{display:none;position:fixed;inset:0;background:#fff;z-index:999;flex-direction:column;align-items:center;justify-content:center;gap:28px}
.mobile-menu a{font-size:22px;color:var(--text);letter-spacing:2px;text-transform:uppercase;font-weight:300}
.mobile-menu .close-btn{position:absolute;top:24px;right:24px;font-size:28px;background:none;border:none;cursor:pointer}
/* ─── PRODUCT CARD (shared across home + collection) ─── */
.pc{cursor:pointer}.pc:hover .pc-img img{transform:scale(1.05)}
.pc-img{overflow:hidden;background:#f6f6f7;aspect-ratio:3/4;border-radius:4px;margin-bottom:12px;position:relative}
.pc-img img{width:100%;height:100%;object-fit:cover;object-position:top center;display:block;transition:transform .4s ease}
.pc-img .emoji{font-size:72px}
.sale-badge{position:absolute;top:10px;left:10px;background:#c0392b;color:#fff;font-size:11px;font-weight:700;padding:3px 8px;border-radius:3px;letter-spacing:.5px;z-index:2}
.pc-meta{padding:0 4px}
.pc-name{font-size:14px;font-weight:500;margin-bottom:4px;line-height:1.3}
.pc-cat{font-size:12px;color:var(--muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:.5px}
.pc-price{font-size:14px;font-weight:600;display:flex;align-items:center;gap:4px;flex-wrap:wrap}
.pc-meta .pc-compare{font-size:13px;color:#bbb;text-decoration:line-through;margin-right:2px}
.pc-meta .pc-sale-price{font-size:14px;color:#c0392b;font-weight:700}
`;

function navHTML() {
  return `<div class="announcement">✨ Designed in Paris · Crafted in Istanbul · Free shipping over ₺500</div>
  <nav class="shopify-nav"><div class="nav-inner">
    <button class="hamburger" onclick="document.getElementById('mobile-nav').classList.toggle('open');document.getElementById('mobile-nav').style.display='flex'">
      <span></span><span></span><span></span>
    </button>
    <a href="/" class="nav-logo">Bon The Label</a>
    <div class="nav-links">
      <a href="/collections" data-tr="Tüm Elbiseler" data-en="All Dresses">Tüm Elbiseler</a>
      <a href="/collections?cat=Dresses" data-tr="Yeni Gelenler" data-en="New Arrivals">Yeni Gelenler</a>
      <a href="/collections?sort=price_asc" data-tr="İndirim" data-en="Sale">İndirim</a>
      <a href="/about" data-tr="Hikayemiz" data-en="Our Story">Hikayemiz</a>
    </div>
    <div class="nav-actions">
      <button onclick="toggleLang()" id="lang-btn" style="background:none;border:1px solid #ddd;border-radius:20px;padding:4px 10px;font-size:12px;cursor:pointer;color:var(--muted);letter-spacing:.5px">🇬🇧 EN</button>
      <a href="/cart" class="cart-link">🛍 <span data-tr="Sepet" data-en="Cart">Sepet</span> <span class="cart-badge" id="cart-count">0</span></a>
    </div>
  </div></nav>
  <div id="mobile-nav" class="mobile-menu">
    <button class="close-btn" onclick="document.getElementById('mobile-nav').style.display='none'">×</button>
    <a href="/" data-tr="Ana Sayfa" data-en="Home">Ana Sayfa</a>
    <a href="/collections" data-tr="Tüm Elbiseler" data-en="All Dresses">Tüm Elbiseler</a>
    <a href="/collections?cat=Dresses" data-tr="Yeni Gelenler" data-en="New Arrivals">Yeni Gelenler</a>
    <a href="/collections?sort=price_asc" data-tr="İndirim" data-en="Sale">İndirim</a>
    <a href="/about" data-tr="Hikayemiz" data-en="Our Story">Hikayemiz</a>
    <a href="/faq">FAQ</a>
    <a href="/contact" data-tr="İletişim" data-en="Contact">İletişim</a>
  </div>`;
}

function cartScript() {
  return `<script>
  let cart = JSON.parse(localStorage.getItem('bond_cart')||'[]');
  function updateCartCount(){const n=cart.reduce((s,i)=>s+i.qty,0);const el=document.getElementById('cart-count');if(el)el.textContent=n;}
  function addToCart(id,name,price,size,color,image){
    const key=id+'_'+size+'_'+color;
    const ex=cart.find(i=>i.key===key);
    if(ex)ex.qty++;else cart.push({key,id,name,price,size,color,image:image||'',qty:1});
    localStorage.setItem('bond_cart',JSON.stringify(cart));updateCartCount();
    if(typeof fbq==='function')fbq('track','AddToCart',{content_name:name,content_type:'product',value:price,currency:'TRY'});
    return true;
  }
  function getCart(){return cart;}
  updateCartCount();
  </script>`;
}

// Meta Pixel — Replace YOUR_PIXEL_ID with real Meta Pixel ID
const META_PIXEL_ID = process.env.META_PIXEL_ID || '697416282656863';

function pixelScript(events) {
  const evts = (events||[]).map(e => typeof e === 'string' ? "fbq('track','"+e+"');" : "fbq('track','"+e.name+"',"+JSON.stringify(e.data||{})+");").join('\n  ');
  return '<script>!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version=\'2.0\';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,\'script\',\'https://connect.facebook.net/en_US/fbevents.js\');fbq(\'init\',\''+META_PIXEL_ID+'\');fbq(\'track\',\'PageView\');'+evts+'</script><noscript><img height="1" width="1" style="display:none" src="https://www.facebook.com/tr?id='+META_PIXEL_ID+'&ev=PageView&noscript=1"/></noscript>';
}

function layout(title, body, extraCSS='', pixelEvents) {
  return `<!DOCTYPE html><html lang="en"><head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title}</title>
  ${pixelScript(pixelEvents)}
  <style>${sharedCSS}${extraCSS}</style>
  </head><body>${navHTML()}${body}
  <footer style="border-top:1px solid var(--border);padding:48px 24px 32px;color:var(--muted);font-size:12px;margin-top:60px">
    <div style="max-width:1100px;margin:0 auto;display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:32px;margin-bottom:40px;text-align:left">
      <div>
        <div style="font-weight:700;font-size:13px;letter-spacing:2px;color:var(--text);margin-bottom:14px;text-transform:uppercase">Bon The Label</div>
        <div style="line-height:2.2;color:#999">🇫🇷 Paris'te Tasarlandı<br>🇹🇷 İstanbul'da Üretildi<br>info@bonthelabel.com<br>Pzt–Cum 09:00–18:00</div>
      </div>
      <div>
        <div style="font-weight:600;font-size:12px;letter-spacing:1.5px;color:var(--text);margin-bottom:14px;text-transform:uppercase">Yardım</div>
        <div style="display:flex;flex-direction:column;gap:8px">
          <a href="/faq" style="color:#999">SSS</a>
          <a href="/shipping" style="color:#999">Kargo ve Teslimat</a>
          <a href="/tracking" style="color:#999">Sipariş Takibi</a>
          <a href="/refund-policy" style="color:#999">İade ve İptal</a>
          <a href="/contact" style="color:#999">İletişim</a>
        </div>
      </div>
      <div>
        <div style="font-weight:600;font-size:12px;letter-spacing:1.5px;color:var(--text);margin-bottom:14px;text-transform:uppercase">Kurumsal</div>
        <div style="display:flex;flex-direction:column;gap:8px">
          <a href="/about" style="color:#999">Hikayemiz</a>
          <a href="/privacy-policy" style="color:#999">Gizlilik Politikası</a>
          <a href="/terms-of-service" style="color:#999">Kullanım Koşulları</a>
          <a href="/faq" style="color:#999">SSS</a>
        </div>
      </div>
      <div>
        <div style="font-weight:600;font-size:12px;letter-spacing:1.5px;color:var(--text);margin-bottom:14px;text-transform:uppercase">Bizi Takip Edin</div>
        <div style="display:flex;flex-direction:column;gap:8px;color:#999">
          <a href="https://instagram.com/bonthelabel" target="_blank" style="color:#999">Instagram</a>
          <a href="https://tiktok.com/@bonthelabel" target="_blank" style="color:#999">TikTok</a>
          <a href="https://pinterest.com/bonthelabel" target="_blank" style="color:#999">Pinterest</a>
        </div>
      </div>
    </div>
    <div style="border-top:1px solid var(--border);padding-top:20px;text-align:center">
      © 2026 Bon The Label · Tüm hakları saklıdır
    </div>
  </footer>
  ${cartScript()}
  <script>
  let currentLang = localStorage.getItem('btl_lang') || 'tr';
  function initLangData() {
    document.querySelectorAll('[data-tr]').forEach(el => {
      if (!el.dataset.en) el.dataset.en = el.textContent.trim();
    });
  }
  function applyLang(lang) {
    currentLang = lang;
    localStorage.setItem('btl_lang', lang);
    const btn = document.getElementById('lang-btn');
    if (btn) btn.innerHTML = lang === 'tr' ? '🇹🇷 TR' : '🇬🇧 EN';
    document.querySelectorAll('[data-tr]').forEach(el => {
      el.textContent = lang === 'tr' ? el.dataset.tr : (el.dataset.en || el.textContent);
    });
    const ann = document.querySelector('.announcement');
    if (ann) ann.textContent = lang === 'tr'
      ? "✨ Paris'te Tasarlandı · İstanbul'da Üretildi · ₺500 üzeri ücretsiz kargo"
      : '✨ Designed in Paris · Crafted in Istanbul · Free shipping over ₺500';
  }
  function toggleLang() { applyLang(currentLang === 'en' ? 'tr' : 'en'); }
  document.addEventListener('DOMContentLoaded', () => {
    initLangData();
    applyLang(currentLang);
  });
  </script>
  </body></html>`;
}

// ─── POLICY PAGES ───
const privacyContent = `
<h1>Gizlilik Politikası</h1>
<p><em>Son güncelleme: Aralık 22, 2025</em></p>
<p>Bu Gizlilik Politikası, Bon The Label ("Site", "biz", "bize" veya "bizim") olarak sitemizi ziyaret ettiğinizde, hizmetlerimizi kullandığınızda veya satın alma yaptığınızda kişisel bilgilerinizi nasıl topladığımızı, kullandığımızı ve paylaştığımızı açıklar.</p>
<h2>Topladığımız Bilgiler</h2>
<ul>
<li><strong>İletişim bilgileri:</strong> adınız, adresiniz, telefon numaranız ve e-posta adresiniz.</li>
<li><strong>Sipariş bilgileri:</strong> fatura adresi, kargo adresi, ödeme onayı, e-posta ve telefon numarası.</li>
<li><strong>Alışveriş bilgileri:</strong> görüntülediğiniz, sepete eklediğiniz veya satın aldığınız ürünler.</li>
<li><strong>Kullanım verileri:</strong> çerezler ve pikseller aracılığıyla toplanan cihaz bilgileri, tarayıcı bilgileri, IP adresi ve etkileşim verileri.</li>
</ul>
<h2>Bilgilerinizi Nasıl Kullanırız</h2>
<ul>
<li>Siparişlerinizi ve ödemelerinizi işlemek için.</li>
<li>Sipariş bildirimlerini ve güncellemelerini göndermek için.</li>
<li>Pazarlama ve promosyon iletişimi için (istediğiniz zaman vazgeçebilirsiniz).</li>
<li>Güvenlik ve dolandırıcılık önleme için.</li>
<li>Hizmetlerimizi geliştirmek için.</li>
</ul>
<h2>Çerezler ve Takip</h2>
<p>Deneyiminizi iyileştirmek ve ilgili reklamlar göstermek için Meta Pixel dahil çerezler ve takip teknolojileri kullanıyoruz. Sitemizi kullanarak çerez kullanımımıza onay vermiş olursunuz.</p>
<h2>Üçüncü Taraflar</h2>
<p>Hizmetlerimizi sunmak için gerektiğinde bilgilerinizi ödeme işlemcileri, kargo sağlayıcıları ve reklam platformlarıyla (Meta/Facebook gibi) paylaşabiliriz.</p>
<h2>Haklarınız</h2>
<p>Kişisel bilgilerinize erişme, düzeltme veya silme hakkına sahipsiniz. Bu hakları kullanmak için info@bonthelabel.com adresinden bize ulaşın.</p>
<h2>İletişim</h2>
<p>Gizlilik sorularınız için <a href="/contact">iletişim sayfamızdan</a> bize ulaşın.</p>
`;

const refundContent = `
<h1>İade Politikası</h1>
<p>Satın aldığınız ürünü sevmenizi istiyoruz! İade etmeniz gerekirse aşağıdaki seçenekleri sunuyoruz:</p>
<h2>İade ve Geri Ödeme</h2>
<p>Teslim tarihinden itibaren <strong>30 gün</strong> içinde iade yapabilirsiniz.</p>
<h2>İade Koşulları</h2>
<ul>
<li>Ürünler yeni durumda olmalıdır — giyilmemiş, yıkanmamış, değiştirilmemiş ve hasarsız.</li>
<li>Orijinal ürün etiketleri takılı ve orijinal ambalaj dahil olmalıdır.</li>
<li>Bu koşulları sağlamayan ürünler iade, değişim veya geri ödeme için kabul edilmez.</li>
<li>Kargo ve iade masrafları müşteriye aittir.</li>
<li>İadeler yalnızca sipariş size teslim edildikten sonra kabul edilir.</li>
</ul>
<h2>İade Nasıl Yapılır</h2>
<p>İade başlatmak için teslimat tarihinden itibaren 30 gün içinde <a href="/contact">iletişim sayfamızdan</a> bize ulaşın. Size iade onayı ve talimatları sağlayacağız.</p>
<h2>Geri Ödeme Süreci</h2>
<p>İade edilen ürünü aldıktan ve inceledikten sonra, orijinal ödeme yönteminize 5-10 iş günü içinde geri ödeme yapacağız.</p>
`;

const termsContent = `
<h1>Kullanım Koşulları</h1>
<p><em>Son güncelleme: Şubat 2026</em></p>
<p>Bu web sitesine erişerek ve kullanarak aşağıdaki hüküm ve koşulları kabul etmiş olursunuz.</p>
<h2>Sitenin Kullanımı</h2>
<p>Bu site kişisel, ticari olmayan kullanım içindir. Yasadışı herhangi bir amaç için veya bu koşulları ihlal ederek kullanamazsınız.</p>
<h2>Ürünler ve Fiyatlandırma</h2>
<p>Fiyatları istediğimiz zaman değiştirme hakkını saklı tutarız. Tüm fiyatlar Türk Lirası (₺) cinsindendir. Herhangi bir siparişi reddetme hakkımız saklıdır.</p>
<h2>Fikri Mülkiyet</h2>
<p>Görseller, metinler, logolar ve tasarımlar dahil bu sitedeki tüm içerik Bon The Label'e aittir; yazılı izin olmaksızın çoğaltılamaz.</p>
<h2>Sorumluluk Sınırlaması</h2>
<p>Bon The Label, bu siteyi veya ürünlerimizi kullanmanızdan kaynaklanan dolaylı, arızi veya sonuçsal zararlardan sorumlu tutulamaz.</p>
<h2>Geçerli Hukuk</h2>
<p>Bu koşullar Türkiye Cumhuriyeti yasalarına tabidir.</p>
<h2>İletişim</h2>
<p>Bu koşullarla ilgili sorularınız için <a href="/contact">bize ulaşın</a>.</p>
`;

const contactContent = `
<h1>Bize Ulaşın</h1>
<p>Size yardımcı olmak için buradayız! Ekibimizle iletişime geçin.</p>
<h2>Müşteri Hizmetleri</h2>
<p><strong>E-posta:</strong> info@bonthelabel.com</p>
<p><strong>Telefon:</strong> +90 212 555 08 42</p>
<p><strong>Çalışma Saatleri:</strong> Pazartesi–Cuma, 09:00 – 18:00 (GMT+3)</p>
<h2>Stüdyolarımız</h2>
<p><strong>🇫🇷 Tasarım Stüdyosu — Paris</strong><br>14 Rue des Archives, Le Marais<br>Paris 75004, Fransa</p>
<p style="margin-top:12px"><strong>🇹🇷 Üretim Atölyesi — İstanbul</strong><br>Nişantaşı Mah. Teşvikiye Cad. No: 14/3<br>Şişli, İstanbul 34365, Türkiye</p>
<h2>İade ve Sipariş Sorgulama</h2>
<p>İade talepleri veya sipariş sorguları için sipariş numaranızla bize e-posta gönderin; 24 saat içinde dönüş yaparız.</p>
<h2>Marka İletişimi</h2>
<p>Basın, ortaklık veya toptan satış sorguları için: press@bonthelabel.com</p>
`;

const aboutContent = `
<h1>Hikayemiz</h1>
<p style="font-size:20px;font-style:italic;color:#888;font-weight:300;margin-bottom:32px;line-height:1.6">Paris'te Tasarlandı. İstanbul'da Üretildi.</p>
<p>Bon The Label, iki şehir arasındaki bir köprüden doğdu — Paris'in sessiz zarafeti ve İstanbul'un sıcak, ustaca elleri. Yaratıcı stüdyomuz Paris'te, her koleksiyonun şekillendiği yer. Atölyemiz İstanbul'da, onlarca yıldır zanaatlarını mükemmelleştiren ustaların her parçaya hayat verdiği yer.</p>
<p>2022'de kurulduk ve basit bir şey yaratmaya çıktık: gerçekten iyi hissettiren kıyafetler. Trend odaklı değil. Tek kullanımlık değil. Bir kadının tekrar tekrar uzandığı, güzelce yapılmış parçalar.</p>
<h2>Paris × İstanbul</h2>
<p>Paris bize gözümüzü veriyor — kısıtlama, orantı, aşırıya kaçmama. İstanbul bize ellerimizi veriyor — hassasiyet, doku, gelenek. Birlikte, hiçbir şehrin tek başına üretemeyeceği bir şey yaratıyorlar.</p>
<p>Tasarım sürecimiz Paris'teki Marais stüdyomuzda başlıyor. Çizimler toile'e, toile'ler prova parçalara, prova parçalar burada gördüğünüz ürünlere dönüşüyor. Ardından İstanbul'un moda bölgesindeki atölye ortaklarımıza gidiyorlar — olağanüstü kalitenin bir hedef değil, standart olduğu yer.</p>
<h2>İnandıklarımız</h2>
<p>Düşünceli yapılmış <strong>yavaş modaya</strong> inanıyoruz — küçük üretim serileri, kaliteli malzemeler ve trendlerin ötesinde tasarımlar. <strong>Kendiniz için giyinmeye</strong> inanıyoruz — özel günler için değil, onay için değil, niyetle yapılmış bir şey giymekten gelen sessiz güven için.</p>
<h2>İsim</h2>
<p><em>Bon</em> — Fransızca'da "iyi" demek. Mükemmel değil. Kusursuz değil. Sadece gerçekten, dürüstçe iyi. İyi kalite. İyi tasarım. Gezegen için iyi. Sizin için iyi. Hepsi bu. Her şey bu.</p>
<h2>Sürdürülebilirlik</h2>
<ul>
<li>Doğal ve düşük etkili kumaşlar: keten, Tencel, organik pamuk, ipek</li>
<li>İsrafı en aza indirmek için küçük seri üretim</li>
<li>Geri dönüştürülebilir ambalaj — plastik yok, fazlalık yok</li>
<li>Tüm siparişlerde karbon nötr kargo</li>
<li>Tedarik zinciri genelinde adil ücretler ve etik çalışma koşulları</li>
</ul>
<h2>İletişime Geçin</h2>
<p>Sizi duymaktan mutluluk duyarız. Stil sorusu, beden endişesi veya sadece bir merhaba olsun — <a href="/contact">info@bonthelabel.com</a> adresinden bize ulaşın.</p>
`;

const shippingContent = `
<h1>Kargo ve Teslimat</h1>
<p>İstanbul'daki atölyemizden dünya genelinde kargo yapıyoruz. Tüm siparişler <strong>1–2 iş günü</strong> içinde işleme alınır.</p>
<h2>Kargo Seçenekleri</h2>
<table style="width:100%;border-collapse:collapse;margin:20px 0">
  <tr style="border-bottom:2px solid #eee;font-weight:600"><td style="padding:12px 8px">Bölge</td><td style="padding:12px 8px">Teslimat Süresi</td><td style="padding:12px 8px">Ücret</td></tr>
  <tr style="border-bottom:1px solid #f0f0f0"><td style="padding:12px 8px">Türkiye</td><td style="padding:12px 8px">1–2 iş günü</td><td style="padding:12px 8px">₺79 · ₺999 üzeri ücretsiz</td></tr>
  <tr style="border-bottom:1px solid #f0f0f0"><td style="padding:12px 8px">Avrupa (AB)</td><td style="padding:12px 8px">3–5 iş günü</td><td style="padding:12px 8px">₺200 · ₺500 üzeri ücretsiz</td></tr>
  <tr style="border-bottom:1px solid #f0f0f0"><td style="padding:12px 8px">ABD ve Kanada</td><td style="padding:12px 8px">5–8 iş günü</td><td style="padding:12px 8px">₺250 · ₺600 üzeri ücretsiz</td></tr>
  <tr style="border-bottom:1px solid #f0f0f0"><td style="padding:12px 8px">Orta Doğu</td><td style="padding:12px 8px">4–6 iş günü</td><td style="padding:12px 8px">₺300 · ₺600 üzeri ücretsiz</td></tr>
  <tr><td style="padding:12px 8px">Dünyanın Geri Kalanı</td><td style="padding:12px 8px">7–14 iş günü</td><td style="padding:12px 8px">₺350</td></tr>
</table>
<h2>Sipariş Takibi</h2>
<p>Siparişiniz kargoya verildiğinde takip numaralı bir onay e-postası alacaksınız. Siparişinizi istediğiniz zaman <a href="/tracking">takip sayfamızdan</a> veya doğrudan kargo şirketinin web sitesinden takip edebilirsiniz.</p>
<p>Kullandığımız kargo şirketleri: <strong>Yurtiçi Kargo</strong> (Türkiye), <strong>DHL Express</strong> (Uluslararası), <strong>FedEx</strong> (ABD/Kanada).</p>
<h2>Gümrük ve Vergiler</h2>
<p>Uluslararası siparişler ithalat vergileri ve harçlarına tabi olabilir; bunlar müşterinin sorumluluğundadır. Tüm gönderilerde doğru gümrük değerlerini beyan ediyoruz.</p>
<h2>Kayıp veya Hasarlı Paketler</h2>
<p>Paketiniz kaybolursa veya hasarlı gelirse, beklenen teslimat tarihinden itibaren 7 gün içinde <a href="/contact">info@bonthelabel.com</a> adresinden bize ulaşın, çözüm üretiriz.</p>
`;

const trackingContent = `
<h1>Siparişimi Takip Et</h1>
<p>Gönderinizi takip etmek için sipariş numaranızı ve e-posta adresinizi girin.</p>
<div style="background:#f9f9f9;border:1px solid #eee;border-radius:12px;padding:40px;max-width:500px;margin:40px auto">
  <div style="margin-bottom:20px">
    <label style="display:block;font-size:13px;font-weight:600;margin-bottom:8px;color:#333">Sipariş Numarası</label>
    <input type="text" placeholder="örn. BTL-20461" style="width:100%;padding:12px 16px;border:1px solid #ddd;border-radius:8px;font-size:15px;box-sizing:border-box;outline:none" />
  </div>
  <div style="margin-bottom:28px">
    <label style="display:block;font-size:13px;font-weight:600;margin-bottom:8px;color:#333">E-posta Adresi</label>
    <input type="email" placeholder="siz@example.com" style="width:100%;padding:12px 16px;border:1px solid #ddd;border-radius:8px;font-size:15px;box-sizing:border-box;outline:none" />
  </div>
  <button onclick="fakeTrack()" style="width:100%;background:#1a1a1a;color:#fff;padding:14px;border:none;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer;letter-spacing:1px">SİPARİŞİ TAKİP ET</button>
  <div id="track-result" style="display:none;margin-top:24px;padding:20px;background:#fff;border:1px solid #eee;border-radius:8px">
    <p style="font-size:13px;color:#888;margin-bottom:8px">SİPARİŞ #BTL-20461</p>
    <p style="font-weight:600;color:#2a7a2a;margin-bottom:16px">✅ Teslimatta — bugün ulaşır</p>
    <div style="font-size:13px;color:#666;line-height:2">
      <div>📦 Sipariş verildi → <span style="color:#aaa">19 Şub 2026</span></div>
      <div>🏭 Atölyede hazırlandı → <span style="color:#aaa">20 Şub 2026</span></div>
      <div>✈️ İstanbul'dan yola çıktı → <span style="color:#aaa">21 Şub 2026</span></div>
      <div>🚚 Teslimatta → <span style="color:#1a1a1a;font-weight:600">Bugün</span></div>
    </div>
  </div>
</div>
<p style="text-align:center;color:#aaa;font-size:13px;margin-top:20px">Siparişinizi bulamıyor musunuz? <a href="/contact" style="color:#1a1a1a">Bize ulaşın</a>, hemen yardımcı olalım.</p>
<script>
function fakeTrack(){
  document.getElementById('track-result').style.display='block';
  document.getElementById('track-result').scrollIntoView({behavior:'smooth'});
}
</script>
`;

const faqContent = `
<h1>Sık Sorulan Sorular</h1>
<div class="faq-list">
<div class="faq-item">
  <h3>Hangi bedeni sipariş etmeliyim?</h3>
  <p>Her ürün sayfasındaki beden rehberimizi incelemenizi öneririz. Elbiselerimiz rahat, feminen bir kesimle tasarlanmıştır — iki beden arasındaysanız büyük bedeni seçin. Keten ve Tencel modellerimizin çoğu doğal esnekliğe sahiptir ve her vücut tipine güzel oturur.</p>
</div>
<div class="faq-item">
  <h3>Kargo ne kadar sürer?</h3>
  <p>Türkiye içi siparişler 1–2 iş günü içinde ulaşır. Avrupa ve uluslararası siparişler hedefe göre genellikle 3–8 iş günü içinde teslim edilir. Ayrıntılar için <a href="/shipping">kargo sayfamıza</a> bakın.</p>
</div>
<div class="faq-item">
  <h3>Siparişimi iade edebilir veya değiştirebilir miyim?</h3>
  <p>Evet! 30 günlük zahmetsiz iade sunuyoruz. Ürünler giyilmemiş ve orijinal durumda olmalıdır. Tam ayrıntılar için <a href="/refund-policy">İade Politikamıza</a> bakın.</p>
</div>
<div class="faq-item">
  <h3>Siparişimi nasıl takip ederim?</h3>
  <p>Siparişiniz kargoya verildiğinde takip e-postası alacaksınız. Ayrıca <a href="/tracking">sipariş takip sayfamızı</a> istediğiniz zaman kullanabilirsiniz.</p>
</div>
<div class="faq-item">
  <h3>Kıyafetleriniz sürdürülebilir mi?</h3>
  <p>Evet — keten, Tencel, organik pamuk ve ipek gibi doğal, düşük etkili kumaşlar kullanıyoruz ve israfı en aza indirmek için küçük seriler üretiyoruz. İstanbul'daki atölye ortaklarımız etik iş standartlarına uyar. <a href="/about">Hakkımızda sayfamızda</a> daha fazla bilgi bulabilirsiniz.</p>
</div>
<div class="faq-item">
  <h3>Yurt dışına kargo yapıyor musunuz?</h3>
  <p>Evet! 40'tan fazla ülkeye kargo yapıyoruz. ₺600 üzeri siparişlerde ücretsiz uluslararası kargo mevcuttur. Tam ayrıntılar için <a href="/shipping">kargo sayfamıza</a> bakın.</p>
</div>
<div class="faq-item">
  <h3>Bon The Label ürünlerimi nasıl temizlemeliyim?</h3>
  <p>Keten ve Tencel parçaların çoğu soğuk suda elle veya makinede narin programda yıkanabilir. İpek parçalar kuru temizlemeye gönderilmeli veya dikkatlice elle yıkanmalıdır. Her zaman ürün üzerindeki bakım etiketini kontrol edin.</p>
</div>
<div class="faq-item">
  <h3>Burada cevabını bulamadığım bir sorum var — nasıl ulaşabilirim?</h3>
  <p>Sizi duymaktan mutluluk duyarız! <a href="/contact">info@bonthelabel.com</a> adresinden e-posta gönderin veya <a href="/contact">iletişim sayfamızı</a> ziyaret edin. İş günlerinde 24 saat içinde dönüş yapıyoruz.</p>
</div>
</div>
<style>
.faq-list{max-width:700px;margin:0 auto}
.faq-item{border-bottom:1px solid var(--border);padding:28px 0}
.faq-item h3{font-size:17px;font-weight:600;margin-bottom:12px;color:var(--text)}
.faq-item p{color:var(--muted);line-height:1.8}
.faq-item a{color:var(--green)}
</style>
`;

function renderPolicy(title, content) {
  const css = `.policy-wrap{max-width:800px;margin:60px auto;padding:0 40px}.policy-wrap h1{font-size:28px;font-weight:500;margin-bottom:8px;padding-bottom:16px;border-bottom:1px solid var(--border)}.policy-wrap h2{font-size:18px;font-weight:500;margin:28px 0 12px}.policy-wrap p{color:var(--muted);line-height:1.8;margin-bottom:12px}.policy-wrap ul{color:var(--muted);padding-left:24px;line-height:2}.policy-wrap a{color:var(--green)}.policy-wrap em{color:#aaa}`;
  return layout(title + ' | Bon The Label', `<div class="policy-wrap">${content}</div>`, css);
}

// ─── HOME ───
function renderHome(products) {
  const cards = products.slice(0,6).map(p => productCard(p)).join('');
  const extraCSS = `
  .hero{position:relative;height:70vh;background:linear-gradient(135deg,#f8f4ef 0%,#ede5da 100%);display:flex;align-items:center;padding:0 80px;overflow:hidden}
  .hero::after{content:'';position:absolute;right:0;top:0;width:45%;height:100%;background:linear-gradient(135deg,#e8d5c0,#d4b896);clip-path:polygon(15% 0,100% 0,100% 100%,0% 100%)}
  .hero-text{position:relative;z-index:1}
  .hero-tag{font-size:12px;letter-spacing:3px;text-transform:uppercase;color:#9b8b7a;margin-bottom:12px}
  .hero h1{font-size:56px;font-weight:300;line-height:1.15;margin-bottom:16px;color:#212121}
  .hero p{font-size:17px;color:#6d7175;margin-bottom:28px;max-width:400px}
  .hero .btn-cta{display:inline-block;background:#212121;color:#fff;padding:14px 36px;font-size:14px;letter-spacing:1px;text-transform:uppercase;border-radius:3px;transition:background .2s}
  .hero .btn-cta:hover{background:#444}
  .section{max-width:1300px;margin:0 auto;padding:60px 24px}
  .section-header{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:32px;border-bottom:1px solid var(--border);padding-bottom:16px}
  .section-header h2{font-size:22px;font-weight:500}
  .section-header a{font-size:13px;color:var(--green)}
  .grid-4{display:grid;grid-template-columns:repeat(4,1fr);gap:20px}
  .pc{cursor:pointer}.pc:hover .pc-img img{transform:scale(1.05)}
  .pc-img{overflow:hidden;background:#f6f6f7;aspect-ratio:3/4;border-radius:4px;margin-bottom:12px;position:relative}
  .pc-img img{width:100%;height:100%;object-fit:cover;object-position:top center;display:block;transition:transform .4s ease}
  .pc-img .emoji{font-size:72px}
  .pc-meta .pc-name{font-size:14px;margin-bottom:4px;font-weight:500}
  .pc-meta .pc-cat{font-size:12px;color:var(--muted);margin-bottom:4px}
  .pc-meta .pc-price{font-size:14px;font-weight:600}
  .pc-meta .pc-compare{font-size:13px;color:#bbb;text-decoration:line-through;margin-right:5px}
  .pc-meta .pc-sale-price{font-size:14px;color:#c0392b;font-weight:600}
  .sale-badge{position:absolute;top:10px;left:10px;background:#c0392b;color:#fff;font-size:11px;font-weight:700;padding:3px 8px;border-radius:3px;letter-spacing:.5px;z-index:2}
  .promo-banner{background:#f6f0e8;padding:60px;text-align:center;margin:0 24px;border-radius:4px}
  .promo-banner h3{font-size:28px;font-weight:300;margin-bottom:8px}
  .promo-banner p{color:var(--muted);margin-bottom:20px}
  @media(max-width:768px){
    .hero{height:auto;min-height:52vw;padding:32px 20px}
    .hero::after{width:30%}
    .hero h1{font-size:30px}
    .hero p{font-size:13px;margin-bottom:18px;max-width:60%}
    .hero .btn-cta{padding:11px 22px;font-size:13px}
    .grid-4{grid-template-columns:repeat(2,1fr);gap:10px}
    .section{padding:28px 14px}
    .section-header h2{font-size:17px}
    .promo-banner{padding:28px 18px;margin:0 10px}
    .promo-banner h3{font-size:18px}
  }
  `;
  return layout('Bon The Label — Women\'s Fashion', `
  <div class="hero">
    <div class="hero-text">
      <div class="hero-tag">Designed in Paris · Crafted in Istanbul</div>
      <h1>Zarifçe.<br>Feminen.<br>Bon.</h1>
      <p>Paris'in özgün estetiği, İstanbul'un ustalığıyla buluşuyor.</p>
      <a href="/collections" class="btn-cta">Koleksiyonu Keşfet</a>
    </div>
  </div>
  <div class="section">
    <div class="section-header"><h2>Yeni Gelenler</h2><a href="/collections">Tümünü gör →</a></div>
    <div class="grid-4">${cards}</div>
  </div>
  <div class="press-bar">
    <div class="press-label">Basında</div>
    <div class="press-logos">
      <span>VOGUE</span><span>Harper's Bazaar</span><span>ELLE</span><span>Who What Wear</span><span>Refinery29</span>
    </div>
  </div>
  <div class="promo-banner">
    <h3>Paris'te Tasarlandı. İstanbul'da Üretildi. Kapınıza Teslim.</h3>
    <p>₺500 üzeri tüm siparişlerde ücretsiz kargo · 30 gün ücretsiz iade</p>
    <a href="/collections" style="background:#212121;color:#fff;padding:12px 32px;border-radius:3px;font-size:13px;letter-spacing:1px;text-transform:uppercase">Hemen Keşfet</a>
  </div>
  <div class="newsletter-section">
    <h3>Bon Topluluğuna Katıl</h3>
    <p>Yeni gelenler, özel teklifler ve stil ilhamı — doğrudan gelen kutunuza.</p>
    <div class="newsletter-form">
      <input type="email" placeholder="e-posta@adresiniz.com" id="nl-email" />
      <button onclick="nlSignup()">%10 İndirim Al</button>
    </div>
    <div id="nl-thanks" style="display:none;color:#4a7c59;margin-top:12px;font-size:14px">✨ Hoş geldiniz! İndirim kodunuz için gelen kutunuzu kontrol edin.</div>
    <p style="font-size:11px;color:#bbb;margin-top:8px">Spam yok. İstediğiniz zaman abonelikten çıkabilirsiniz.</p>
  </div>
  <script>function nlSignup(){const e=document.getElementById('nl-email').value;if(!e||!e.includes('@'))return;document.querySelector('.newsletter-form').style.display='none';document.getElementById('nl-thanks').style.display='block';}</script>
  `, extraCSS + `
  .press-bar{border-top:1px solid var(--border);border-bottom:1px solid var(--border);padding:20px 24px;display:flex;align-items:center;justify-content:center;gap:32px;overflow:hidden}
  .press-label{font-size:11px;letter-spacing:2px;color:#bbb;text-transform:uppercase;white-space:nowrap}
  .press-logos{display:flex;gap:32px;align-items:center;flex-wrap:wrap;justify-content:center}
  .press-logos span{font-size:13px;font-weight:700;letter-spacing:2px;color:#ccc;text-transform:uppercase;font-style:italic}
  .newsletter-section{background:#f9f6f2;padding:64px 24px;text-align:center}
  .newsletter-section h3{font-size:26px;font-weight:400;margin-bottom:10px;letter-spacing:1px}
  .newsletter-section p{color:var(--muted);margin-bottom:24px;font-size:15px}
  .newsletter-form{display:flex;gap:0;max-width:440px;margin:0 auto;border:1px solid #ddd;border-radius:4px;overflow:hidden;background:#fff}
  .newsletter-form input{flex:1;border:none;padding:14px 18px;font-size:14px;outline:none;background:transparent}
  .newsletter-form button{background:#1a1a1a;color:#fff;border:none;padding:14px 24px;font-size:13px;letter-spacing:1px;cursor:pointer;white-space:nowrap;text-transform:uppercase}
  .newsletter-form button:hover{background:#333}
  `);
}

function productCard(p) {
  const hasSale = p.compare_price && p.compare_price > p.price;
  const sale = hasSale ? `<span class="sale-badge">SALE</span>` : '';
  const priceHTML = hasSale
    ? `<span class="pc-compare">₺${p.compare_price.toFixed(0)}</span> <span class="pc-sale-price">₺${p.price.toFixed(0)}</span>`
    : `₺${p.price.toFixed(0)}`;
  return `<div class="pc" onclick="location.href='/product/${p.id}'">
    <div class="pc-img">${p.image ? `<img src="${p.image}" alt="${p.name}">` : `<div class="emoji">👗</div>`}${sale}</div>
    <div class="pc-meta">
      <div class="pc-name">${p.name}</div>
      <div class="pc-cat">${p.category || 'Dresses'}</div>
      <div class="pc-price">${priceHTML}</div>
    </div>
  </div>`;
}

// ─── COLLECTION ───
function renderCollection(products, query) {
  const { cat, sort, min, max } = query;
  const extraCSS = `
  .collection-layout{display:grid;grid-template-columns:240px 1fr;gap:32px;max-width:1300px;margin:0 auto;padding:32px 24px}
  .sidebar h3{font-size:13px;font-weight:600;letter-spacing:.5px;text-transform:uppercase;margin-bottom:16px;padding-bottom:10px;border-bottom:1px solid var(--border)}
  .filter-group{margin-bottom:28px}
  .filter-group label{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--muted);margin-bottom:8px;cursor:pointer}
  .filter-group label:hover{color:var(--text)}
  .filter-group input[type=checkbox]{accent-color:var(--green)}
  .price-inputs{display:flex;gap:8px;margin-top:8px}
  .price-inputs input{width:100%;padding:8px;border:1px solid var(--border);border-radius:4px;font-size:13px}
  .apply-btn{background:var(--text);color:#fff;border:none;padding:8px 16px;border-radius:4px;cursor:pointer;font-size:12px;width:100%;margin-top:8px}
  .collection-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;padding-bottom:16px;border-bottom:1px solid var(--border)}
  .collection-header h1{font-size:22px;font-weight:500}
  .product-count{font-size:13px;color:var(--muted)}
  .sort-select{padding:8px 12px;border:1px solid var(--border);border-radius:4px;font-size:13px;background:#fff;cursor:pointer}
  .grid-3{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}
  .breadcrumb{font-size:12px;color:var(--muted);padding:12px 24px;max-width:1300px;margin:0 auto}
  .breadcrumb a{color:var(--muted)}
  .active-filter{display:inline-flex;align-items:center;gap:6px;background:var(--bg);border:1px solid var(--border);padding:4px 10px;border-radius:20px;font-size:12px;margin-right:8px;margin-bottom:12px}
  @media(max-width:768px){
    .collection-layout{grid-template-columns:1fr;padding:14px;gap:14px}
    .sidebar{display:none}
    .grid-3{grid-template-columns:repeat(2,1fr);gap:10px}
    .collection-header{flex-wrap:wrap;gap:8px}
    .collection-header h1{font-size:17px}
    .sort-select{width:100%}
    .breadcrumb{padding:8px 14px}
  }
  `;
  const cards = products.map(p => productCard(p)).join('');
  return layout(`${cat || 'All Dresses'} | Bon The Label`, `
  <div class="breadcrumb"><a href="/">Ana Sayfa</a> / <a href="/collections">Koleksiyonlar</a>${cat ? ' / ' + cat : ''}</div>
  <div class="collection-layout">
    <aside class="sidebar">
      <form method="GET" action="/collections">
        <div class="filter-group">
          <h3>Kategori</h3>
          <label><input type="radio" name="cat" value="" ${!cat?'checked':''}> Tüm Elbiseler</label>
          <label><input type="radio" name="cat" value="Dresses" ${cat==='Dresses'?'checked':''}> Elbiseler</label>
        </div>
        <div class="filter-group">
          <h3>Fiyat</h3>
          <label><input type="radio" name="sort" value="price_asc" ${sort==='price_asc'?'checked':''}> Fiyat: Düşükten Yükseğe</label>
          <label><input type="radio" name="sort" value="price_desc" ${sort==='price_desc'?'checked':''}> Fiyat: Yüksekten Düşüğe</label>
          <label><input type="radio" name="sort" value="" ${!sort?'checked':''}> Öne Çıkanlar</label>
          <div class="price-inputs">
            <input type="number" name="min" placeholder="Min ₺" value="${min||''}">
            <input type="number" name="max" placeholder="Max ₺" value="${max||''}">
          </div>
          <button type="submit" class="apply-btn">Filtrele</button>
        </div>
      </form>
    </aside>
    <main>
      <div class="collection-header">
        <div>
          <h1>${cat || 'Tüm Koleksiyonlar'}</h1>
          <div class="product-count">${products.length} ürün</div>
        </div>
        <select class="sort-select" onchange="location.href='/collections?sort='+this.value${cat?`+'&cat=${cat}'`:''}">
          <option value="" ${!sort?'selected':''}>Öne Çıkanlar</option>
          <option value="price_asc" ${sort==='price_asc'?'selected':''}>Fiyat: Düşükten Yükseğe</option>
          <option value="price_desc" ${sort==='price_desc'?'selected':''}>Fiyat: Yüksekten Düşüğe</option>
        </select>
      </div>
      <div class="grid-3">${cards || '<p style="color:var(--muted);grid-column:1/-1">Ürün bulunamadı.</p>'}</div>
    </main>
  </div>`, extraCSS);
}

// ─── PRODUCT ───
function renderProduct(p, related) {
  const sizesRaw = p.sizes || 'XS,S,M,L,XL';
  const sizes = sizesRaw.trim().startsWith('[')
    ? (() => { try { return JSON.parse(sizesRaw); } catch(e) { return ['XS','S','M','L','XL']; } })()
    : sizesRaw.split(',').map(s => s.trim().replace(/['"[\]]/g,''));
  const colors = (p.colors||'Black').split(',').map(c => c.trim());
  const savings = p.compare_price ? ((p.compare_price - p.price) / p.compare_price * 100).toFixed(0) : null;
  const extraCSS = `
  .pd-layout{max-width:1200px;margin:0 auto;padding:32px 24px;display:grid;grid-template-columns:1fr 1fr;gap:60px;align-items:start}
  .pd-gallery{position:sticky;top:80px}
  .pd-main-img{background:#f6f0e8;border-radius:4px;aspect-ratio:3/4;display:flex;align-items:center;justify-content:center;overflow:hidden;margin-bottom:12px}
  .pd-main-img img{width:100%;height:100%;object-fit:cover}
  .pd-main-img .emoji{font-size:140px}
  .pd-thumbs{display:grid;grid-template-columns:repeat(6,1fr);gap:6px}
  .pd-thumb{background:#f6f0e8;border-radius:3px;aspect-ratio:1;display:flex;align-items:center;justify-content:center;cursor:pointer;border:2px solid transparent;font-size:32px;overflow:hidden}
  .pd-thumb img{width:100%;height:100%;object-fit:cover}
  .pd-thumb.active{border-color:var(--text)}
  .pd-info{}
  .pd-vendor{font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px}
  .pd-title{font-size:26px;font-weight:500;margin-bottom:12px;line-height:1.3}
  .pd-rating{display:flex;align-items:center;gap:8px;margin-bottom:16px;font-size:13px;color:var(--muted)}
  .stars{color:#f59e0b;font-size:15px}
  .pd-price{margin-bottom:20px}
  .pd-price .current{font-size:24px;font-weight:600;color:var(--text)}
  .pd-price .was{font-size:16px;color:var(--muted);text-decoration:line-through;margin-left:10px}
  .pd-price .save{background:#d82c0d;color:#fff;font-size:12px;font-weight:600;padding:2px 8px;border-radius:2px;margin-left:8px}
  .divider{border:none;border-top:1px solid var(--border);margin:20px 0}
  .option-label{font-size:13px;font-weight:600;margin-bottom:10px}
  .size-grid{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:20px}
  .size-opt{padding:9px 16px;border:1px solid var(--border);border-radius:3px;font-size:13px;cursor:pointer;transition:all .15s;background:#fff;color:var(--text)}
  .size-opt:hover{border-color:#888;background:#f5f5f5}
  .size-opt.active{border-color:var(--text);background:var(--text);color:#fff}
  .color-row{display:flex;gap:10px;margin-bottom:20px}
  .color-swatch{width:32px;height:32px;border-radius:50%;cursor:pointer;border:3px solid transparent;transition:all .15s;position:relative}
  .color-swatch.active{border-color:#fff;box-shadow:0 0 0 2px var(--text)}
  .atc-section{margin-top:8px}
  .qty-row{display:flex;align-items:center;gap:12px;margin-bottom:16px}
  .qty-btn{width:36px;height:36px;border:1px solid var(--border);background:#fff;cursor:pointer;font-size:18px;border-radius:3px}
  .qty-input{width:56px;text-align:center;border:1px solid var(--border);padding:8px;border-radius:3px;font-size:14px}
  .trust-badges{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:20px}
  .badge{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--muted)}
  .tabs{margin-top:32px;border-top:1px solid var(--border)}
  .tab-headers{display:flex;gap:0}
  .tab-h{padding:14px 20px;cursor:pointer;font-size:13px;border-bottom:2px solid transparent;color:var(--muted);transition:all .2s}
  .tab-h.active{border-color:var(--text);color:var(--text);font-weight:500}
  .tab-body{display:none;padding:20px 0;font-size:14px;color:var(--muted);line-height:1.7}
  .tab-body.active{display:block}
  .related-section{max-width:1200px;margin:0 auto;padding:0 24px 60px}
  .related-section h3{font-size:18px;font-weight:500;margin-bottom:24px;padding-bottom:16px;border-bottom:1px solid var(--border)}
  .grid-4r{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}
  @media(max-width:768px){
    .pd-layout{grid-template-columns:1fr;gap:20px;padding:14px}
    .pd-gallery{position:static}
    .pd-title{font-size:20px}
    .pd-price .current{font-size:20px}
    .trust-badges{grid-template-columns:1fr 1fr;gap:8px}
    .grid-4r{grid-template-columns:repeat(2,1fr);gap:10px}
    .related-section{padding:0 14px 36px}
    .size-grid{gap:6px}
    .size-opt{padding:8px 12px;font-size:12px}
  }
  `;
  return layout(`${p.name} | Bon The Label`, `
  <div style="font-size:12px;color:var(--muted);padding:12px 24px;max-width:1200px;margin:0 auto">
    <a href="/">Ana Sayfa</a> / <a href="/collections">Koleksiyonlar</a> / ${p.name}
  </div>
  <div class="pd-layout">
    <div class="pd-gallery">
      <div class="pd-main-img" id="mainImgWrap">${p.image ? `<img id="mainImg" src="${p.image}" alt="${p.name}">` : `<div class="emoji">👗</div>`}</div>
      <div class="pd-thumbs">
        ${(() => {
          const gallery = (() => { try { return JSON.parse(p.gallery||'[]'); } catch(e) { return []; } })();
          const allImgs = p.image ? [p.image, ...gallery.filter(x=>x!==p.image)] : gallery;
          if (allImgs.length === 0) return ['👗','✨','🪡','📦'].map((e,i) => `<div class="pd-thumb${i===0?' active':''}">${e}</div>`).join('');
          return allImgs.map((img,i) => `<div class="pd-thumb${i===0?' active':''}" onclick="switchImg(this,'${img}')"><img src="${img}" alt="view ${i+1}"></div>`).join('');
        })()}
      </div>
    </div>
    <div class="pd-info">
      <div class="pd-vendor">Bon The Label</div>
      <h1 class="pd-title">${p.name}</h1>
      <div class="pd-rating"><span class="stars">★★★★★</span> <span>4.9 (127 değerlendirme)</span></div>
      <div class="pd-price">
        <span class="current">₺${p.price.toFixed(0)}</span>
        ${p.compare_price ? `<span class="was">₺${p.compare_price.toFixed(0)}</span><span class="save">%${savings} İndirim</span>` : ''}
      </div>
      <div id="stock-indicator" style="background:#fff8ed;border:1px solid #fde68a;border-radius:4px;padding:10px 14px;font-size:13px;color:#92400e;margin-bottom:20px">🔥 Stokta yalnızca <span id="stock-num">4</span> adet kaldı — hemen sipariş verin</div>
      <div style="font-size:12px;color:#aaa;margin:-12px 0 18px;font-style:italic">Modelin boyu 172cm (5'8") ve S beden giyiyor</div>
      <hr class="divider">
      <div class="option-label">Beden <a href="#" onclick="document.getElementById('size-guide-modal').style.display='flex';return false;" style="color:var(--green);font-size:12px;font-weight:normal;margin-left:8px">Beden Rehberi</a></div>
      <div class="size-grid" id="sizes">
        ${sizes.map((s,i) => `<button class="size-opt${i===0?' active':''}" onclick="selectSize(this,'${s}')">${s}</button>`).join('')}
      </div>
      <hr class="divider">
      <div class="atc-section">
        <div class="qty-row">
          <button class="qty-btn" onclick="changeQty(-1)">−</button>
          <input type="number" class="qty-input" id="qty" value="1" min="1" max="10" readonly>
          <button class="qty-btn" onclick="changeQty(1)">+</button>
        </div>
        <button class="btn-primary btn-atc" data-tr="Sepete Ekle" onclick="handleATC(${p.id},'${p.name}',${p.price})">Sepete Ekle</button>
        <button class="btn-secondary btn-buy" data-tr="Hemen Satın Al" onclick="handleBuyNow(${p.id},'${p.name}',${p.price})">Hemen Satın Al</button>
      </div>
      <div class="trust-badges">
        <div class="badge">🚚 ₺500 üzeri ücretsiz kargo</div>
        <div class="badge">↩️ 30 gün ücretsiz iade</div>
        <div class="badge">🔒 Güvenli ödeme</div>
        <div class="badge">✅ İstanbul'da üretildi</div>
      </div>
      <div style="display:flex;gap:6px;align-items:center;margin-top:14px;flex-wrap:wrap">
        <span style="border:1px solid #ddd;border-radius:4px;padding:2px 7px;font-size:11px;font-weight:700;color:#1a1a6e;letter-spacing:.5px">VISA</span>
        <span style="border:1px solid #ddd;border-radius:4px;padding:2px 7px;font-size:11px;font-weight:700;color:#eb001b;letter-spacing:.5px">MC</span>
        <span style="border:1px solid #ddd;border-radius:4px;padding:2px 7px;font-size:11px;font-weight:700;color:#003087;letter-spacing:.5px">PayPal</span>
        <span style="border:1px solid #ddd;border-radius:4px;padding:2px 7px;font-size:11px;font-weight:700;color:#007bc1;letter-spacing:.5px">AMEX</span>
        <span style="font-size:11px;color:#999;margin-left:4px">🔒 SSL Güvenli / Secured</span>
      </div>
      <div class="tabs">
        <div class="tab-headers">
          <div class="tab-h active" onclick="switchTab(this,'desc')">Açıklama</div>
          <div class="tab-h" onclick="switchTab(this,'care')">Bakım</div>
          <div class="tab-h" onclick="switchTab(this,'shipping')">Kargo</div>
        </div>
        <div class="tab-body active" id="desc">${p.description || 'Açıklama mevcut değil.'}</div>
        <div class="tab-body" id="care">Soğuk suda makine yıkaması, narin program. Ağartmayın. Düşük ısıda kurutun. Düşük ısıda ütüleyin. Gerekirse kuru temizleme.</div>
        <div class="tab-body" id="shipping">Standart kargo (2–4 iş günü): ₺500 üzeri ücretsiz<br>Ekspres kargo (1–2 gün): ₺199<br>30 gün içinde ücretsiz iade.</div>
      </div>
    </div>
  </div>
  <!-- SIZE GUIDE MODAL -->
  <div id="size-guide-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:1000;align-items:center;justify-content:center">
    <div style="background:#fff;border-radius:8px;padding:36px;max-width:520px;width:90%;max-height:80vh;overflow-y:auto;position:relative">
      <button onclick="document.getElementById('size-guide-modal').style.display='none'" style="position:absolute;top:16px;right:16px;background:none;border:none;font-size:22px;cursor:pointer;color:#666">×</button>
      <h2 style="font-size:20px;font-weight:500;margin-bottom:20px">Beden Rehberi</h2>
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <tr style="border-bottom:2px solid #eee;background:#f9f9f9"><th style="padding:10px 8px;text-align:left">Beden</th><th style="padding:10px 8px">Göğüs</th><th style="padding:10px 8px">Bel</th><th style="padding:10px 8px">Kalça</th></tr>
        <tr style="border-bottom:1px solid #f0f0f0"><td style="padding:10px 8px">XS</td><td style="padding:10px 8px;text-align:center">81–84 cm</td><td style="padding:10px 8px;text-align:center">61–64 cm</td><td style="padding:10px 8px;text-align:center">87–90 cm</td></tr>
        <tr style="border-bottom:1px solid #f0f0f0;background:#fafafa"><td style="padding:10px 8px">S</td><td style="padding:10px 8px;text-align:center">85–88 cm</td><td style="padding:10px 8px;text-align:center">65–68 cm</td><td style="padding:10px 8px;text-align:center">91–94 cm</td></tr>
        <tr style="border-bottom:1px solid #f0f0f0"><td style="padding:10px 8px">M</td><td style="padding:10px 8px;text-align:center">89–93 cm</td><td style="padding:10px 8px;text-align:center">69–73 cm</td><td style="padding:10px 8px;text-align:center">95–99 cm</td></tr>
        <tr style="border-bottom:1px solid #f0f0f0;background:#fafafa"><td style="padding:10px 8px">L</td><td style="padding:10px 8px;text-align:center">94–99 cm</td><td style="padding:10px 8px;text-align:center">74–79 cm</td><td style="padding:10px 8px;text-align:center">100–105 cm</td></tr>
        <tr style="background:#fafafa"><td style="padding:10px 8px">XL</td><td style="padding:10px 8px;text-align:center">100–106 cm</td><td style="padding:10px 8px;text-align:center">80–86 cm</td><td style="padding:10px 8px;text-align:center">106–112 cm</td></tr>
      </table>
      <p style="font-size:12px;color:#aaa;margin-top:16px">İki beden arasındaysanız büyük bedeni seçin. Elbiselerimiz rahat, feminen bir kesimle tasarlanmıştır.</p>
    </div>
  </div>
  <!-- REVIEWS -->
  <div style="max-width:1200px;margin:0 auto;padding:0 24px 60px">
    <h3 style="font-size:20px;font-weight:500;margin-bottom:8px;padding-bottom:16px;border-bottom:1px solid var(--border)">Müşteri Yorumları <span style="font-size:14px;font-weight:400;color:#aaa">(${Math.floor(Math.random()*80)+50} yorum)</span></h3>
    <div style="display:flex;align-items:center;gap:16px;margin:16px 0 28px">
      <div style="font-size:48px;font-weight:300">4.8</div>
      <div>
        <div style="font-size:20px;color:#f59e0b">★★★★★</div>
        <div style="font-size:13px;color:#aaa">Based on verified purchases</div>
      </div>
    </div>
    ${[
      { name:'Sophie M.', stars:5, date:'Jan 14, 2026', text:'Absolutely stunning dress. The fabric is incredibly soft — so much better than I expected from photos. I\'m 5\'7" and ordered a size S. Perfect length for me. Will definitely be ordering more!' },
      { name:'Elif K.', stars:5, date:'Feb 2, 2026', text:'Bu elbise harika! Kumaş kalitesi gerçekten çok iyi. İstanbul\'dan sipariş verdim, 2 günde geldi. Kesinlikle tekrar alışveriş yapacağım 🤍' },
      { name:'Charlotte D.', stars:5, date:'Feb 8, 2026', text:'I bought this for a wedding and got SO many compliments. The linen feels luxurious and it photographs beautifully. True to size, I went with my usual medium.' },
      { name:'Zeynep A.', stars:4, date:'Feb 15, 2026', text:'Çok şık bir elbise. Rengi tam fotoğraftaki gibi çıktı. Sadece küçük bir sorun vardı, hızlı çözüldü. Harika müşteri desteği için teşekkürler!' }
    ].map(r => `
    <div style="border-bottom:1px solid #f5f5f5;padding:20px 0">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <div>
          <span style="font-weight:600;font-size:14px">${r.name}</span>
          <span style="color:#f59e0b;margin-left:8px">${'★'.repeat(r.stars)}${'☆'.repeat(5-r.stars)}</span>
          <span style="font-size:11px;background:#e8f5e9;color:#2e7d32;padding:2px 7px;border-radius:10px;margin-left:8px">✓ Verified Purchase</span>
        </div>
        <span style="font-size:12px;color:#bbb">${r.date}</span>
      </div>
      <p style="font-size:14px;color:#555;line-height:1.7;margin:0">${r.text}</p>
    </div>`).join('')}
  </div>
  ${related.length ? `<div class="related-section"><h3>You May Also Like</h3><div class="grid-4r">${related.map(productCard).join('')}</div></div>` : ''}
  <script>
  // Random stock display
  document.getElementById('stock-num').textContent = Math.floor(Math.random()*4)+2;
  let selSize='${sizes[0]}', selColor='${colors[0]}';
  function selectSize(el,s){document.querySelectorAll('.size-opt').forEach(b=>b.classList.remove('active'));el.classList.add('active');selSize=s;}
  function selectColor(el,c){document.querySelectorAll('.color-swatch').forEach(b=>b.classList.remove('active'));el.classList.add('active');selColor=c;document.getElementById('color-name').textContent=c;}
  function changeQty(d){const i=document.getElementById('qty');const v=Math.max(1,Math.min(10,parseInt(i.value)+d));i.value=v;}
  function switchTab(el,id){document.querySelectorAll('.tab-h').forEach(t=>t.classList.remove('active'));document.querySelectorAll('.tab-body').forEach(t=>t.classList.remove('active'));el.classList.add('active');document.getElementById(id).classList.add('active');}
  function handleATC(id,name,price){const qty=parseInt(document.getElementById('qty').value);const img=document.getElementById('mainImg')?document.getElementById('mainImg').src:'';for(let i=0;i<qty;i++)addToCart(id,name,price,selSize,selColor,img);const btn=event.target;const orig=btn.textContent;btn.textContent=currentLang==='tr'?'Eklendi! ✓':'Added! ✓';btn.style.background='#004c3f';setTimeout(()=>{btn.textContent=orig;btn.style.background='';},2000);}
  function handleBuyNow(id,name,price){const qty=parseInt(document.getElementById('qty').value);const img=document.getElementById('mainImg')?document.getElementById('mainImg').src:'';for(let i=0;i<qty;i++)addToCart(id,name,price,selSize,selColor,img);location.href='/checkout';}
  function switchImg(el,src){document.getElementById('mainImg').src=src;document.querySelectorAll('.pd-thumb').forEach(t=>t.classList.remove('active'));el.classList.add('active');}
  </script>`, extraCSS, [{name:'ViewContent', data:{content_name: p.name, content_type:'product', value: p.price, currency:'TRY'}}]);
}

// ─── CART ───
function renderCart() {
  const extraCSS = `.cart-wrap{max-width:900px;margin:40px auto;padding:0 24px}.cart-wrap h1{font-size:24px;font-weight:500;margin-bottom:32px;padding-bottom:16px;border-bottom:1px solid var(--border)}`;
  return layout('Sepetim | Bon The Label', `
  <div class="cart-wrap">
    <h1>Sepetim</h1>
    <div id="cart-body"><p style="color:var(--muted);text-align:center;padding:60px 0">Sepetiniz boş. <a href="/collections" style="color:var(--green)">Alışverişe devam et</a></p></div>
  </div>
  <script>
  window.addEventListener('load', () => {
    const cart = getCart();
    const body = document.getElementById('cart-body');
    if (!cart.length) return;
    const total = cart.reduce((s,i)=>s+i.price*i.qty,0);
    body.innerHTML = cart.map(i=>'<div style="display:flex;gap:16px;align-items:center;padding:16px 0;border-bottom:1px solid var(--border)">'+
      (i.image?'<img src="'+i.image+'" style="width:80px;height:96px;object-fit:cover;border-radius:6px;flex-shrink:0;" loading="lazy">':'<div style="width:80px;height:96px;background:#f0ebe3;border-radius:6px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:24px;">👗</div>')+
      '<div style="flex:1"><div style="font-weight:500">'+i.name+'</div><div style="font-size:12px;color:var(--muted);margin-top:4px">'+i.color+' / '+i.size+'</div><div style="font-size:13px;color:var(--muted);margin-top:4px">Adet: '+i.qty+'</div></div>'+
      '<div style="font-weight:600;font-size:15px">₺'+(i.price*i.qty).toFixed(0)+'</div></div>').join('') +
      '<div style="display:flex;justify-content:space-between;align-items:center;padding:20px 0;font-size:18px;font-weight:600"><span>Toplam</span><span>₺'+total.toFixed(0)+'</span></div>'+
      '<a href="/checkout" style="display:block;background:var(--green);color:#fff;padding:16px;text-align:center;border-radius:4px;font-size:15px;font-weight:500;margin-top:8px">Ödemeye Geç</a>'+
      '<a href="/collections" style="display:block;text-align:center;color:var(--muted);margin-top:12px;font-size:13px">Alışverişe Devam Et</a>';
  });
  </script>`, extraCSS);
}

// ─── CHECKOUT ───
function renderCheckout() {
  const extraCSS = `
  .checkout-page{display:grid;grid-template-columns:1fr 380px;min-height:calc(100vh - 56px);background:#fff}
  .checkout-form-side{padding:40px 60px 60px;border-right:1px solid var(--border)}
  .checkout-summary-side{background:#f6f6f7;padding:40px 40px 60px;border-left:1px solid var(--border)}
  .co-logo{font-size:18px;font-weight:700;letter-spacing:3px;text-transform:uppercase;margin-bottom:24px;display:block}
  .co-breadcrumb{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--muted);margin-bottom:32px}
  .co-breadcrumb .active{color:var(--text);font-weight:500}
  .co-breadcrumb span{color:#ddd}
  .co-section{margin-bottom:28px}
  .co-section-title{font-size:16px;font-weight:500;margin-bottom:16px;color:var(--text)}
  .field-row{display:grid;grid-template-columns:1fr 1fr;gap:12px}
  .field{margin-bottom:12px;position:relative}
  .field label{position:absolute;top:13px;left:13px;font-size:12px;color:var(--muted);pointer-events:none;transition:all .15s}
  .field input:focus~label,.field input:not(:placeholder-shown)~label{top:6px;font-size:10px;color:var(--green)}
  .field input{width:100%;padding:20px 13px 8px;border:1px solid var(--border);border-radius:5px;font-size:14px;background:#fff;transition:border-color .15s;outline:none}
  .field input:focus{border-color:var(--green);box-shadow:0 0 0 3px rgba(0,128,96,.1)}
  .co-submit{background:var(--green);color:#fff;width:100%;padding:16px;border:none;border-radius:5px;font-size:16px;font-weight:500;cursor:pointer;transition:background .2s}
  .co-submit:hover{background:#006e52}
  .co-footer-links{display:flex;gap:16px;font-size:12px;color:var(--muted);margin-top:20px}
  .co-footer-links a{color:var(--muted)}
  .summary-item{display:flex;align-items:center;gap:12px;margin-bottom:16px}
  .summary-img{width:64px;height:80px;background:#e8e0d8;border-radius:8px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:28px;position:relative;overflow:hidden;}
  .summary-qty{position:absolute;top:-8px;right:-8px;background:#6d7175;color:#fff;font-size:10px;font-weight:700;width:20px;height:20px;border-radius:50%;display:flex;align-items:center;justify-content:center}
  .summary-name{font-size:14px;font-weight:500;margin-bottom:2px}
  .summary-variant{font-size:12px;color:var(--muted)}
  .summary-price{margin-left:auto;font-size:14px;font-weight:500}
  .summary-divider{border:none;border-top:1px solid var(--border);margin:16px 0}
  .summary-line{display:flex;justify-content:space-between;font-size:14px;margin-bottom:8px;color:var(--muted)}
  .summary-total{display:flex;justify-content:space-between;font-size:16px;font-weight:600;margin-top:8px;color:var(--text)}
  .shipping-option{display:flex;align-items:center;justify-content:space-between;border:1px solid var(--border);border-radius:5px;padding:14px 16px;margin-bottom:8px;cursor:pointer}
  .shipping-option.selected{border-color:var(--green);background:#f0fdf4}
  .payment-icons{display:flex;gap:8px;margin-bottom:12px}
  .picon{background:#f6f6f7;border:1px solid var(--border);border-radius:4px;padding:4px 8px;font-size:12px;color:var(--muted)}
  @media(max-width:768px){
    .checkout-page{grid-template-columns:1fr}
    .checkout-summary-side{order:-1;padding:18px 16px;border-left:none;border-bottom:1px solid var(--border)}
    .checkout-form-side{padding:22px 16px 40px;border-right:none}
    .field-row{grid-template-columns:1fr}
  }
  `;
  return layout('Ödeme | Bon The Label', `
  <div class="checkout-page">
    <div class="checkout-form-side">
      <a href="/" class="co-logo">Bon The Label</a>
      <div class="co-breadcrumb">
        <a href="/cart">Sepet</a> <span>›</span>
        <span class="active">Bilgiler</span> <span>›</span>
        <span>Kargo</span> <span>›</span>
        <span>Ödeme</span>
      </div>
      <form method="POST" action="/checkout">
        <div class="co-section">
          <div class="co-section-title">İletişim</div>
          <div class="field">
            <input type="email" name="email" placeholder=" " required id="email">
            <label for="email">E-posta</label>
          </div>
        </div>
        <div class="co-section">
          <div class="co-section-title">Teslimat</div>
          <div class="field-row">
            <div class="field"><input type="text" name="first" placeholder=" " required id="first"><label for="first">Ad</label></div>
            <div class="field"><input type="text" name="last" placeholder=" " required id="last"><label for="last">Soyad</label></div>
          </div>
          <div class="field"><input type="text" name="address" placeholder=" " required id="addr"><label for="addr">Adres</label></div>
          <div class="field-row">
            <div class="field"><input type="text" name="city" placeholder=" " required id="city"><label for="city">Şehir</label></div>
            <div class="field"><input type="text" name="zip" placeholder=" " required id="zip"><label for="zip">Posta kodu</label></div>
          </div>
          <div class="field"><input type="text" name="country" placeholder=" " value="Türkiye" id="country"><label for="country">Ülke</label></div>
        </div>
        <div class="co-section">
          <div class="co-section-title">Kargo yöntemi</div>
          <div class="shipping-option selected">
            <div><div style="font-size:13px;font-weight:500">Standart Kargo</div><div style="font-size:12px;color:var(--muted)">2–4 iş günü</div></div>
            <div style="font-size:13px;font-weight:500">Ücretsiz</div>
          </div>
          <div class="shipping-option">
            <div><div style="font-size:13px;font-weight:500">Ekspres Kargo</div><div style="font-size:12px;color:var(--muted)">1–2 iş günü</div></div>
            <div style="font-size:13px;font-weight:500">₺199</div>
          </div>
        </div>
        <div class="co-section">
          <div class="co-section-title">Ödeme
            <div class="payment-icons" style="display:inline-flex;margin-left:12px">
              <span class="picon">VISA</span><span class="picon">MC</span><span class="picon">AMEX</span>
            </div>
          </div>
          <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:4px;padding:10px 14px;font-size:12px;color:#166534;margin-bottom:16px">🔒 Tüm işlemler güvenli ve şifrelidir</div>
          <div class="field"><input type="text" name="card" placeholder=" " required id="card"><label for="card">Kart numarası</label></div>
          <div class="field-row">
            <div class="field"><input type="text" name="expiry" placeholder=" " required id="expiry"><label for="expiry">Son kullanma tarihi (AA/YY)</label></div>
            <div class="field"><input type="text" name="cvv" placeholder=" " required id="cvv"><label for="cvv">Güvenlik kodu</label></div>
          </div>
          <div class="field"><input type="text" name="cardholder" placeholder=" " id="ch"><label for="ch">Kart üzerindeki isim</label></div>
        </div>
        <button type="submit" class="co-submit" onclick="if(typeof fbq==='function'){const c=getCart();const t=c.reduce((s,i)=>s+i.price*i.qty,0);fbq('track','Purchase',{value:t,currency:'TRY',content_type:'product',num_items:c.length});}">Şimdi Öde</button>
        <div class="co-footer-links">
          <a href="/refund-policy">İade Politikası</a>
          <a href="/shipping">Kargo Politikası</a>
          <a href="/privacy-policy">Gizlilik Politikası</a>
        </div>
      </form>
    </div>
    <div class="checkout-summary-side">
      <div id="summary-items">
        <div style="text-align:center;padding:40px 0;color:var(--muted);font-size:13px">Ürünleri burада görmek için sepetinize ekleyin</div>
      </div>
      <hr class="summary-divider">
      <div class="summary-line"><span>Ara Toplam</span><span id="subtotal">—</span></div>
      <div class="summary-line"><span>Kargo</span><span style="color:var(--green)">Ücretsiz</span></div>
      <hr class="summary-divider">
      <div class="summary-total"><span>Toplam</span><span id="total">—</span></div>
      <div style="font-size:12px;color:var(--muted);margin-top:8px">Vergiler dahil</div>
    </div>
  </div>
  <script>
  window.addEventListener('load', () => {
    const cart = getCart();
    const items = document.getElementById('summary-items');
    const sub = document.getElementById('subtotal');
    const tot = document.getElementById('total');
    if (!cart.length) return;
    const total = cart.reduce((s,i)=>s+i.price*i.qty,0);
    items.innerHTML = cart.map(i=>'<div class="summary-item"><div class="summary-img">'+(i.image?'<img src="'+i.image+'" style="width:100%;height:100%;object-fit:cover;border-radius:8px;">':'👗')+'<span class="summary-qty">'+i.qty+'</span></div><div style="flex:1"><div class="summary-name">'+i.name+'</div><div class="summary-variant">'+i.color+' / '+i.size+'</div></div><div class="summary-price">$'+(i.price*i.qty).toFixed(2)+'</div></div>').join('');
    sub.textContent = '₺'+total.toFixed(0);
    tot.textContent = '₺'+total.toFixed(0);
  });
  </script>`, extraCSS, ['InitiateCheckout']);
}

function renderCheckoutError() {
  return layout('Payment Failed | Bon The Label', `
  <div style="max-width:480px;margin:80px auto;text-align:center;padding:0 24px">
    <div style="font-size:48px;margin-bottom:20px">💳</div>
    <h2 style="font-size:24px;font-weight:500;margin-bottom:12px">Your payment was declined</h2>
    <p style="color:var(--muted);margin-bottom:8px;line-height:1.6">We were unable to process your payment. Please check your card details or try a different payment method.</p>
    <code style="display:inline-block;background:#f6f6f7;border:1px solid var(--border);padding:6px 14px;border-radius:4px;font-size:12px;color:#d82c0d;margin:16px 0">CARD_DECLINED · TEST_MODE</code>
    <div style="display:flex;gap:12px;justify-content:center;margin-top:20px">
      <a href="/checkout" style="background:var(--green);color:#fff;padding:13px 28px;border-radius:4px;font-size:14px;font-weight:500">Try again</a>
      <a href="/collections" style="background:#fff;color:var(--text);padding:13px 28px;border-radius:4px;font-size:14px;border:1px solid var(--border)">Continue shopping</a>
    </div>
  </div>`, undefined, [{name:'Purchase', data:{value:0, currency:'TRY'}}]);
}

// ─── ADMIN ───
function renderAdmin(products) {
  const rows = products.map(p=>`<tr>
    <td>${p.id}</td>
    <td>${p.image?`<img src="${p.image}" style="width:48px;height:60px;object-fit:cover;border-radius:4px">`:'-'}</td>
    <td><strong>${p.name}</strong><br><small style="color:#6d7175">${p.category} · SKU: ${p.sku||'-'}</small></td>
    <td>₺${p.price.toFixed(0)}${p.compare_price?`<br><small style="text-decoration:line-through;color:#999">₺${p.compare_price.toFixed(0)}</small>`:''}</td>
    <td><form method="POST" action="/admin/delete/${p.id}" onsubmit="return confirm('Delete ${p.name}?')"><button type="submit" style="background:#d82c0d;color:#fff;border:none;padding:6px 14px;border-radius:4px;cursor:pointer;font-size:12px">Delete</button></form></td>
  </tr>`).join('');
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Admin | Bon The Label</title>
  <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,sans-serif;background:#f6f6f7;color:#212121;font-size:14px}
  .ah{background:#212121;color:#fff;padding:16px 32px;display:flex;justify-content:space-between;align-items:center}
  .ah h1{font-size:16px;letter-spacing:2px;font-weight:600}.ah a{color:#aaa;text-decoration:none;font-size:12px}
  .ab{padding:32px;max-width:1100px;margin:0 auto}
  .card{background:#fff;border:1px solid #e1e3e5;border-radius:8px;padding:28px;margin-bottom:32px}
  .card h2{font-size:15px;font-weight:600;margin-bottom:20px;padding-bottom:12px;border-bottom:1px solid #e1e3e5}
  .fg{display:grid;grid-template-columns:1fr 1fr;gap:14px}.fgf{grid-column:1/-1}
  label{display:block;font-size:12px;font-weight:500;color:#6d7175;margin-bottom:5px}
  input,textarea,select{width:100%;padding:9px 12px;border:1px solid #e1e3e5;border-radius:4px;font-size:14px;background:#fff}
  textarea{height:72px;resize:vertical}
  .sb{background:#008060;color:#fff;border:none;padding:10px 24px;border-radius:4px;cursor:pointer;font-size:14px;font-weight:500;margin-top:8px}
  table{width:100%;background:#fff;border:1px solid #e1e3e5;border-radius:8px;overflow:hidden;border-collapse:collapse}
  th{background:#f6f6f7;padding:10px 14px;text-align:left;font-size:12px;font-weight:600;color:#6d7175;border-bottom:1px solid #e1e3e5;text-transform:uppercase;letter-spacing:.5px}
  td{padding:12px 14px;border-bottom:1px solid #f0f0f0;vertical-align:middle}
  tr:last-child td{border-bottom:none}
  .pg{margin-bottom:6px}
  </style></head><body>
  <div class="ah"><h1>Bon The Label ADMIN</h1><a href="/">← View Store</a></div>
  <div class="ab">
    <div class="card">
      <h2>Add New Product</h2>
      <form method="POST" action="/admin/add" enctype="multipart/form-data">
        <div class="fg">
          <div class="pg"><label>Product Name *</label><input name="name" required placeholder="e.g. Silk Evening Dress"></div>
          <div class="pg"><label>Price ($) *</label><input type="number" name="price" step="0.01" required placeholder="89.00"></div>
          <div class="pg"><label>Compare-at Price ($)</label><input type="number" name="compare_price" step="0.01" placeholder="120.00"></div>
          <div class="pg"><label>Category</label><input name="category" placeholder="Dresses"></div>
          <div class="pg"><label>SKU</label><input name="sku" placeholder="ELD-001"></div>
          <div class="pg"><label>Image</label><input type="file" name="image" accept="image/*"></div>
          <div class="pg"><label>Sizes (comma-separated)</label><input name="sizes" placeholder="XS,S,M,L,XL" value="XS,S,M,L,XL"></div>
          <div class="pg"><label>Colors (comma-separated)</label><input name="colors" placeholder="Black,White,Beige" value="Black,White"></div>
          <div class="pg fgf"><label>Description</label><textarea name="description" placeholder="Product description..."></textarea></div>
        </div>
        <button type="submit" class="sb">Add Product</button>
      </form>
    </div>
    <div style="font-size:15px;font-weight:600;margin-bottom:12px">${products.length} Products</div>
    <table><thead><tr><th>ID</th><th>Image</th><th>Product</th><th>Price</th><th>Actions</th></tr></thead>
    <tbody>${rows}</tbody></table>
  </div></body></html>`;
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log('Bon The Label running on port ' + PORT));
