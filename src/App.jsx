import { useState, useMemo, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line
} from "recharts";
import {
  Upload, MapPin, CreditCard, Truck, Ticket, Users,
  ShoppingBag, TrendingUp, Package, Star, ChevronUp, ChevronDown, Search
} from "lucide-react";

// ─── CATEGORY MAP ────────────────────────────────────────────────────────────
const SKU_CATEGORY = {
  "A-B": "Fashion & Kostum", "A-S": "Fashion & Kostum",
  "A-T": "Aksesoris & Harness", "B-0": "Tempat Tidur",
  "C-0": "Snack & Dental", "D-0": "Wadah Makan & Minum",
  "EXT": "Packing Tambahan", "G-0": "Grooming & Perawatan",
  "H-0": "Stroller & Hygiene", "L-0": "Toilet Training",
  "T-0": "Mainan", "V-0": "Vitamin & Obat",
};
const getCategory = (sku) => SKU_CATEGORY[sku ? sku.slice(0,3) : ""] || "Lainnya";

const PALETTE = ["#FF6B35","#004E89","#1A936F","#E84855","#3185FC","#88D498","#F7C59F","#C6DABF","#8884d8","#82ca9d"];

// ─── NUMBER HELPER (format Indonesia: 199.000 = 199000) ──────────────────────
const cleanNum = (val) => {
  if (!val) return 0;
  let v = String(val).trim().replace(/[^\d.,]/g, "");
  if (!v) return 0;
  if (v.includes(",")) {
    v = v.replace(/\./g, "").replace(",", ".");
  } else {
    const parts = v.split(".");
    if (parts.length > 1 && parts[parts.length - 1].length === 3) v = v.replace(/\./g, "");
  }
  return parseFloat(v) || 0;
};
const fmt = (n) => "Rp " + Math.round(n).toLocaleString("id-ID");

// ─── CSV PARSER ──────────────────────────────────────────────────────────────
const parseCSV = (text) => {
  const rows = [];
  let cur = "", inQ = false, cols = [];
  for (let i = 0; i <= text.length; i++) {
    const ch = text[i];
    if (ch === '"') { inQ = !inQ; }
    else if ((ch === "," || ch === "\n" || ch === undefined) && !inQ) {
      cols.push(cur.trim()); cur = "";
      if (ch === "\n" || ch === undefined) { rows.push(cols); cols = []; }
    } else { cur += ch; }
  }
  return rows.slice(1).filter(r => r.length > 10 && r[0]).map(r => ({
    orderId:          r[0],
    status:           r[1],
    alasanPembatalan: (r[2] || "").trim(),
    paymentMethod:    r[11] || "Unknown",
    skuInduk:         r[12] || "",
    productName:      r[13] || "",
    hargaAwal:        cleanNum(r[16]),
    hargaDiskon:      cleanNum(r[17]),
    qty:              cleanNum(r[18]),
    totalHargaProduk: cleanNum(r[20]),
    diskonPenjual:    cleanNum(r[22]),
    diskonShopee:     cleanNum(r[23]),
    beratProduk:      r[24] || "",
    voucherPenjual:   cleanNum(r[27]),
    voucherShopee:    cleanNum(r[29]),
    ongkirDibayar:    cleanNum(r[35]),
    ongkirPotongan:   cleanNum(r[36]),
    totalPembayaran:  cleanNum(r[38]),
    perkiraanOngkir:  cleanNum(r[39]),
    username:         r[42] || "Unknown",
    kota:             r[46] || "Unknown",
    provinsi:         r[47] || "Unknown",
    category:         getCategory(r[12]),
    orderDate:        r[9] ? r[9].slice(0, 10) : "",
  }));
};

// ─── COMPONENTS ──────────────────────────────────────────────────────────────
const StatCard = ({ icon: Icon, label, value, sub, color }) => (
  <div style={{ background:"#fff", borderRadius:16, padding:"20px 24px", boxShadow:"0 2px 12px rgba(0,0,0,.07)", borderLeft:`4px solid ${color}`, display:"flex", flexDirection:"column", gap:6 }}>
    <div style={{ display:"flex", alignItems:"center", gap:8, color }}>
      <Icon size={18}/><span style={{ fontSize:12, fontWeight:700, textTransform:"uppercase", letterSpacing:1 }}>{label}</span>
    </div>
    <div style={{ fontSize:26, fontWeight:800, color:"#111", lineHeight:1.1 }}>{value}</div>
    {sub && <div style={{ fontSize:12, color:"#888" }}>{sub}</div>}
  </div>
);

const CustomTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:"#111", color:"#fff", borderRadius:10, padding:"10px 14px", fontSize:13 }}>
      <div style={{ fontWeight:700, marginBottom:4 }}>{label}</div>
      {payload.map((p,i) => (
        <div key={i} style={{ color: p.color||"#FF6B35" }}>
          {p.name}: {typeof p.value==="number" && p.value>1000 ? fmt(p.value) : p.value}
        </div>
      ))}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [data, setData]     = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab]       = useState("overview");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("total");
  const [sortDir, setSortDir] = useState("desc");

  const handleFile = useCallback((e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { setData(parseCSV(ev.target.result)); setLoaded(true); };
    reader.readAsText(file);
  }, []);

  // ── Analytics ──────────────────────────────────────────────────────────────
  const A = useMemo(() => {
    if (!data.length) return null;

    // Unique orders
    const orderMap = {};
    data.forEach(r => {
      if (!orderMap[r.orderId]) orderMap[r.orderId] = { ...r, items: [] };
      orderMap[r.orderId].items.push(r);
    });
    const orders = Object.values(orderMap);
    const totalRevenue = orders.reduce((s,o) => s + o.totalPembayaran, 0);
    const totalOrders  = orders.length;

    // Payment
    const paymentMap = {};
    orders.forEach(o => { paymentMap[o.paymentMethod] = (paymentMap[o.paymentMethod]||0)+1; });

    // Location
    const kotaMap = {}, provMap = {};
    orders.forEach(o => {
      kotaMap[o.kota]     = (kotaMap[o.kota]||0)+1;
      provMap[o.provinsi] = (provMap[o.provinsi]||0)+1;
    });

    // Shipping selisih — exclude cancelled (alasanPembatalan != "")
    let selisihTotal = 0, countSelisih = 0;
    const selisihMap = {};
    data.forEach(r => {
      if (r.alasanPembatalan) return;
      const selisih = r.perkiraanOngkir - (r.ongkirDibayar + r.ongkirPotongan);
      if (Math.abs(selisih) > 0) {
        if (!selisihMap[r.orderId]) {
          selisihMap[r.orderId] = {
            orderId: r.orderId, username: r.username,
            kota: r.kota, provinsi: r.provinsi,
            ongkirDibayar: r.ongkirDibayar, ongkirPotongan: r.ongkirPotongan,
            perkiraanOngkir: r.perkiraanOngkir, selisih, items: []
          };
          selisihTotal += selisih;
          countSelisih++;
        }
        selisihMap[r.orderId].items.push({
          productName: r.productName, beratProduk: r.beratProduk,
          qty: r.qty, category: r.category
        });
      }
    });
    const selisihList = Object.values(selisihMap).sort((a,b) => Math.abs(b.selisih)-Math.abs(a.selisih));

    // Voucher
    let voucherPenjualCount=0, voucherShopeeCount=0, totalVoucherPenjual=0, totalVoucherShopee=0;
    data.forEach(r => {
      if (r.voucherPenjual>0) { voucherPenjualCount++; totalVoucherPenjual+=r.voucherPenjual; }
      if (r.voucherShopee>0)  { voucherShopeeCount++;  totalVoucherShopee+=r.voucherShopee;  }
    });

    // Category
    const catRevenue={}, catCount={}, catQty={};
    data.forEach(r => {
      catRevenue[r.category] = (catRevenue[r.category]||0) + r.totalHargaProduk;
      catCount[r.category]   = (catCount[r.category]||0)   + 1;
      catQty[r.category]     = (catQty[r.category]||0)     + r.qty;
    });

    // Users
    const userMap = {};
    data.forEach(r => {
      if (!userMap[r.username]) userMap[r.username] = {
        username:r.username, orders:new Set(), total:0, items:0,
        categories:{}, provinces:new Set(), vouchers:0
      };
      const u = userMap[r.username];
      u.orders.add(r.orderId);
      u.total    += r.totalHargaProduk;
      u.items    += r.qty;
      u.categories[r.category] = (u.categories[r.category]||0)+1;
      u.provinces.add(r.provinsi);
      if (r.voucherPenjual>0||r.voucherShopee>0) u.vouchers++;
    });
    const users = Object.values(userMap).map(u => ({
      ...u,
      orderCount:   u.orders.size,
      topCategory:  Object.entries(u.categories).sort((a,b)=>b[1]-a[1])[0]?.[0]||"-",
      avgPerOrder:  u.orders.size>0 ? u.total/u.orders.size : 0,
    }));

    // Daily
    const dailyMap = {};
    orders.forEach(o => {
      if (!o.orderDate) return;
      dailyMap[o.orderDate] = (dailyMap[o.orderDate]||0) + o.totalPembayaran;
    });
    const daily = Object.entries(dailyMap).sort((a,b)=>a[0]>b[0]?1:-1)
      .map(([date,revenue]) => ({ date:date.slice(5), revenue }));

    // Status
    const statusMap = {};
    orders.forEach(o => { statusMap[o.status]=(statusMap[o.status]||0)+1; });

    return {
      totalRevenue, totalOrders, avgOrder: totalRevenue/totalOrders,
      paymentMap, kotaMap, provMap,
      selisihTotal, countSelisih, selisihList,
      voucherPenjualCount, voucherShopeeCount, totalVoucherPenjual, totalVoucherShopee,
      catRevenue, catCount, catQty,
      users, daily, statusMap, uniqueUsers: users.length,
    };
  }, [data]);

  // ── User table sort/filter ─────────────────────────────────────────────────
  const filteredUsers = useMemo(() => {
    if (!A) return [];
    return A.users
      .filter(u => u.username.toLowerCase().includes(search.toLowerCase()))
      .sort((a,b) => sortDir==="desc" ? b[sortKey]-a[sortKey] : a[sortKey]-b[sortKey]);
  }, [A, search, sortKey, sortDir]);

  const toggleSort = (key) => {
    if (sortKey===key) setSortDir(d=>d==="desc"?"asc":"desc");
    else { setSortKey(key); setSortDir("desc"); }
  };

  // ── Upload screen ──────────────────────────────────────────────────────────
  if (!loaded) return (
    <div style={{ minHeight:"100vh", background:"linear-gradient(135deg,#0f0f1a,#1a1a2e,#16213e)", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Segoe UI',sans-serif" }}>
      <div style={{ background:"rgba(255,255,255,.05)", backdropFilter:"blur(20px)", border:"1px solid rgba(255,255,255,.1)", borderRadius:24, padding:"56px 48px", textAlign:"center", maxWidth:440 }}>
        <div style={{ width:80, height:80, borderRadius:"50%", background:"linear-gradient(135deg,#FF6B35,#f7c59f)", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 28px" }}>
          <Upload size={36} color="#fff"/>
        </div>
        <h1 style={{ color:"#fff", fontSize:28, fontWeight:800, marginBottom:8 }}>Consumer Intelligence</h1>
        <p style={{ color:"rgba(255,255,255,.55)", fontSize:14, marginBottom:36, lineHeight:1.6 }}>
          Upload file CSV ekspor pesanan Shopee untuk memulai analisis mendalam.
        </p>
        <label style={{ cursor:"pointer" }}>
          <div style={{ background:"linear-gradient(135deg,#FF6B35,#e85a28)", color:"#fff", borderRadius:12, padding:"14px 32px", fontWeight:700, fontSize:15, display:"inline-block" }}>
            📂 Pilih File CSV
          </div>
          <input type="file" accept=".csv" onChange={handleFile} style={{ display:"none" }}/>
        </label>
      </div>
    </div>
  );

  // ── Derived chart data ─────────────────────────────────────────────────────
  const catBarData = Object.entries(A.catRevenue)
    .map(([name,revenue]) => ({ name, revenue, orders:A.catCount[name], qty:A.catQty[name] }))
    .sort((a,b)=>b.revenue-a.revenue);

  const payData  = Object.entries(A.paymentMap).map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value);
  const kotaData = Object.entries(A.kotaMap).sort((a,b)=>b[1]-a[1]).slice(0,15).map(([name,value])=>({name,value}));
  const provData = Object.entries(A.provMap).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([name,value])=>({name,value}));

  const TABS = [
    { id:"overview",  label:"📊 Overview"   },
    { id:"location",  label:"📍 Lokasi"     },
    { id:"payment",   label:"💳 Pembayaran" },
    { id:"shipping",  label:"🚚 Ongkir"     },
    { id:"voucher",   label:"🎟 Voucher"    },
    { id:"category",  label:"📦 Kategori"   },
    { id:"users",     label:"👥 Konsumen"   },
  ];

  return (
    <div style={{ fontFamily:"'Segoe UI',sans-serif", minHeight:"100vh", background:"#f4f5f7" }}>

      {/* HEADER */}
      <div style={{ background:"linear-gradient(135deg,#111827,#1f2937)", padding:"20px 32px", display:"flex", alignItems:"center", justifyContent:"space-between", boxShadow:"0 4px 24px rgba(0,0,0,.3)" }}>
        <div>
          <h1 style={{ color:"#fff", fontSize:22, fontWeight:800, margin:0 }}>🛍 Consumer Intelligence Dashboard</h1>
          <p style={{ color:"rgba(255,255,255,.5)", fontSize:12, margin:"4px 0 0" }}>{A.totalOrders} pesanan · {A.uniqueUsers} pembeli unik · Jan 2025</p>
        </div>
        <button onClick={()=>setLoaded(false)} style={{ background:"rgba(255,255,255,.08)", border:"1px solid rgba(255,255,255,.15)", color:"#fff", borderRadius:10, padding:"8px 16px", cursor:"pointer", fontSize:13, display:"flex", alignItems:"center", gap:6 }}>
          <Upload size={14}/> Ganti File
        </button>
      </div>

      {/* TABS */}
      <div style={{ background:"#fff", borderBottom:"1px solid #e5e7eb", padding:"0 32px", display:"flex", overflowX:"auto" }}>
        {TABS.map(t => (
          <button key={t.id} onClick={()=>setTab(t.id)} style={{
            padding:"14px 20px", border:"none", background:"none", cursor:"pointer",
            fontSize:13, fontWeight:600, whiteSpace:"nowrap",
            color: tab===t.id?"#FF6B35":"#6b7280",
            borderBottom: tab===t.id?"3px solid #FF6B35":"3px solid transparent",
            transition:"all .2s"
          }}>{t.label}</button>
        ))}
      </div>

      <div style={{ padding:"28px 32px", maxWidth:1400, margin:"0 auto" }}>

        {/* ══ OVERVIEW ══════════════════════════════════════════════════════ */}
        {tab==="overview" && (
          <div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))", gap:16, marginBottom:28 }}>
              <StatCard icon={TrendingUp} label="Total Revenue"  value={fmt(A.totalRevenue)} sub={`Avg ${fmt(A.avgOrder)}/pesanan`} color="#FF6B35"/>
              <StatCard icon={ShoppingBag} label="Total Pesanan" value={A.totalOrders.toLocaleString()} sub="Pesanan unik" color="#004E89"/>
              <StatCard icon={Users} label="Pembeli Unik"        value={A.uniqueUsers} sub={`Avg ${(A.totalOrders/A.uniqueUsers).toFixed(1)}x/user`} color="#1A936F"/>
              <StatCard icon={Package} label="Item Terjual"      value={data.reduce((s,r)=>s+r.qty,0).toLocaleString()} sub="Total unit" color="#E84855"/>
              <StatCard icon={Ticket} label="Pakai Voucher"      value={A.voucherPenjualCount+A.voucherShopeeCount} sub="Penggunaan voucher" color="#8884d8"/>
              <StatCard icon={Truck} label="Selisih Ongkir"      value={fmt(A.selisihTotal)} sub={`${A.countSelisih} transaksi berselisih`} color="#88D498"/>
            </div>

            <div style={{ background:"#fff", borderRadius:16, padding:24, boxShadow:"0 2px 12px rgba(0,0,0,.06)", marginBottom:24 }}>
              <h2 style={{ margin:"0 0 20px", fontSize:16, fontWeight:700 }}>📈 Tren Revenue Harian</h2>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={A.daily}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
                  <XAxis dataKey="date" tick={{fontSize:11}}/>
                  <YAxis tickFormatter={v=>"Rp"+(v/1e6).toFixed(1)+"M"} tick={{fontSize:11}}/>
                  <Tooltip content={<CustomTip/>}/>
                  <Line type="monotone" dataKey="revenue" stroke="#FF6B35" strokeWidth={2.5} dot={false} name="Revenue"/>
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:24 }}>
              <div style={{ background:"#fff", borderRadius:16, padding:24, boxShadow:"0 2px 12px rgba(0,0,0,.06)" }}>
                <h2 style={{ margin:"0 0 20px", fontSize:16, fontWeight:700 }}>✅ Status Pesanan</h2>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={Object.entries(A.statusMap).map(([n,v])=>({name:n,value:v}))} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={3}>
                      {Object.keys(A.statusMap).map((_,i)=><Cell key={i} fill={PALETTE[i%PALETTE.length]}/>)}
                    </Pie>
                    <Tooltip/><Legend iconSize={10} wrapperStyle={{fontSize:12}}/>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div style={{ background:"#fff", borderRadius:16, padding:24, boxShadow:"0 2px 12px rgba(0,0,0,.06)" }}>
                <h2 style={{ margin:"0 0 20px", fontSize:16, fontWeight:700 }}>🏆 Top Kategori Revenue</h2>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={catBarData.slice(0,6)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={false}/>
                    <XAxis type="number" tickFormatter={v=>"Rp"+(v/1e6).toFixed(0)+"M"} tick={{fontSize:11}}/>
                    <YAxis type="category" dataKey="name" width={130} tick={{fontSize:11}}/>
                    <Tooltip content={<CustomTip/>}/>
                    <Bar dataKey="revenue" fill="#FF6B35" radius={[0,6,6,0]} name="Revenue"/>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* ══ LOCATION ══════════════════════════════════════════════════════ */}
        {tab==="location" && (
          <div>
            <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr", gap:24, marginBottom:24 }}>
              <div style={{ background:"#fff", borderRadius:16, padding:24, boxShadow:"0 2px 12px rgba(0,0,0,.06)" }}>
                <h2 style={{ margin:"0 0 20px", fontSize:16, fontWeight:700 }}>📍 Top 15 Kota/Kabupaten</h2>
                <ResponsiveContainer width="100%" height={420}>
                  <BarChart data={kotaData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={false}/>
                    <XAxis type="number" tick={{fontSize:11}}/>
                    <YAxis type="category" dataKey="name" width={160} tick={{fontSize:11}}/>
                    <Tooltip content={<CustomTip/>}/>
                    <Bar dataKey="value" fill="#004E89" radius={[0,6,6,0]} name="Pesanan"/>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div style={{ background:"#fff", borderRadius:16, padding:24, boxShadow:"0 2px 12px rgba(0,0,0,.06)" }}>
                <h2 style={{ margin:"0 0 20px", fontSize:16, fontWeight:700 }}>🗺 Provinsi</h2>
                <ResponsiveContainer width="100%" height={420}>
                  <PieChart>
                    <Pie data={provData} cx="50%" cy="45%" innerRadius={55} outerRadius={100} dataKey="value" paddingAngle={2}>
                      {provData.map((_,i)=><Cell key={i} fill={PALETTE[i%PALETTE.length]}/>)}
                    </Pie>
                    <Tooltip/><Legend iconSize={10} wrapperStyle={{fontSize:11}}/>
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div style={{ background:"#fff", borderRadius:16, padding:24, boxShadow:"0 2px 12px rgba(0,0,0,.06)" }}>
              <h2 style={{ margin:"0 0 16px", fontSize:16, fontWeight:700 }}>Semua Provinsi</h2>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))", gap:10 }}>
                {Object.entries(A.provMap).sort((a,b)=>b[1]-a[1]).map(([prov,count],i) => (
                  <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 14px", background:"#f9fafb", borderRadius:10 }}>
                    <span style={{ fontSize:13, color:"#374151" }}>{prov}</span>
                    <span style={{ fontWeight:700, color:"#FF6B35", fontSize:14 }}>{count} <span style={{ color:"#9ca3af", fontWeight:400, fontSize:11 }}>pesanan</span></span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ══ PAYMENT ══════════════════════════════════════════════════════ */}
        {tab==="payment" && (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:24 }}>
            <div style={{ background:"#fff", borderRadius:16, padding:24, boxShadow:"0 2px 12px rgba(0,0,0,.06)" }}>
              <h2 style={{ margin:"0 0 20px", fontSize:16, fontWeight:700 }}>💳 Distribusi Metode Pembayaran</h2>
              <ResponsiveContainer width="100%" height={320}>
                <PieChart>
                  <Pie data={payData} cx="50%" cy="50%" outerRadius={110} dataKey="value" paddingAngle={3}
                    label={({percent})=>`${(percent*100).toFixed(0)}%`} labelLine={false}>
                    {payData.map((_,i)=><Cell key={i} fill={PALETTE[i%PALETTE.length]}/>)}
                  </Pie>
                  <Tooltip/><Legend iconSize={10} wrapperStyle={{fontSize:12}}/>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div style={{ background:"#fff", borderRadius:16, padding:24, boxShadow:"0 2px 12px rgba(0,0,0,.06)" }}>
              <h2 style={{ margin:"0 0 20px", fontSize:16, fontWeight:700 }}>Rincian Metode Pembayaran</h2>
              <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
                {payData.map((p,i) => (
                  <div key={i}>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                      <span style={{ fontSize:13, fontWeight:600, color:"#374151" }}>{p.name}</span>
                      <span style={{ fontSize:13, fontWeight:700, color:PALETTE[i%PALETTE.length] }}>{p.value} ({((p.value/A.totalOrders)*100).toFixed(1)}%)</span>
                    </div>
                    <div style={{ height:6, background:"#f0f0f0", borderRadius:99 }}>
                      <div style={{ height:"100%", background:PALETTE[i%PALETTE.length], borderRadius:99, width:`${(p.value/A.totalOrders)*100}%` }}/>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ══ SHIPPING ══════════════════════════════════════════════════════ */}
        {tab==="shipping" && (
          <div>
            {/* KPI */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:16, marginBottom:24 }}>
              <StatCard icon={Truck} label="Perkiraan Ongkir"      value={fmt(data.reduce((s,r)=>s+r.perkiraanOngkir,0))} sub="Total estimasi platform" color="#004E89"/>
              <StatCard icon={Truck} label="Ongkir Dibayar Pembeli" value={fmt(data.reduce((s,r)=>s+r.ongkirDibayar,0))}   sub="Dibayar oleh pembeli"    color="#1A936F"/>
              <StatCard icon={Truck} label="Estimasi Potongan"      value={fmt(data.reduce((s,r)=>s+r.ongkirPotongan,0))}  sub="Subsidi / potongan"      color="#8884d8"/>
              <StatCard icon={Truck} label="Total Selisih"          value={fmt(A.selisihTotal)} sub={`${A.countSelisih} transaksi berselisih`} color="#FF6B35"/>
            </div>

            {/* Formula box */}
            <div style={{ background:"#fff", borderRadius:16, padding:"16px 20px", marginBottom:24, boxShadow:"0 2px 12px rgba(0,0,0,.06)", borderLeft:"4px solid #FF6B35" }}>
              <p style={{ margin:0, fontSize:13, color:"#374151", lineHeight:2 }}>
                <strong>📐 Rumus Selisih Ongkir:</strong><br/>
                <code style={{ background:"#f3f4f6", padding:"3px 10px", borderRadius:6, fontSize:13 }}>
                  Selisih = Perkiraan Ongkir − (Ongkir Dibayar Pembeli + Estimasi Potongan)
                </code>
                <br/>
                <span style={{ color:"#6b7280", fontSize:12 }}>⚠️ Transaksi dengan kolom <strong>Alasan Pembatalan</strong> tidak ikut dihitung.</span>
              </p>
            </div>

            {/* Avg ongkir per province */}
            <div style={{ background:"#fff", borderRadius:16, padding:24, boxShadow:"0 2px 12px rgba(0,0,0,.06)", marginBottom:24 }}>
              <h2 style={{ margin:"0 0 20px", fontSize:16, fontWeight:700 }}>Rata-rata Ongkir Dibayar per Provinsi</h2>
              {(() => {
                const pO={}, pC={};
                data.forEach(r=>{ pO[r.provinsi]=(pO[r.provinsi]||0)+r.ongkirDibayar; pC[r.provinsi]=(pC[r.provinsi]||0)+1; });
                const cd = Object.entries(pO).map(([n,t])=>({name:n,avgOngkir:t/pC[n]})).sort((a,b)=>b.avgOngkir-a.avgOngkir).slice(0,12);
                return (
                  <ResponsiveContainer width="100%" height={320}>
                    <BarChart data={cd} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" horizontal={false}/>
                      <XAxis type="number" tickFormatter={v=>"Rp"+v.toLocaleString("id-ID")} tick={{fontSize:11}}/>
                      <YAxis type="category" dataKey="name" width={160} tick={{fontSize:11}}/>
                      <Tooltip content={<CustomTip/>}/>
                      <Bar dataKey="avgOngkir" fill="#1A936F" radius={[0,6,6,0]} name="Avg Ongkir"/>
                    </BarChart>
                  </ResponsiveContainer>
                );
              })()}
            </div>

            {/* ── Detail transaksi berselisih ─────────────────────────────── */}
            <div style={{ background:"#fff", borderRadius:16, overflow:"hidden", boxShadow:"0 2px 12px rgba(0,0,0,.06)" }}>
              <div style={{ padding:"20px 24px", borderBottom:"1px solid #f3f4f6", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                <h2 style={{ margin:0, fontSize:16, fontWeight:700 }}>🔍 Detail Transaksi Berselisih Ongkir</h2>
                <span style={{ background:"#FEF3C7", color:"#92400E", borderRadius:99, padding:"4px 14px", fontSize:12, fontWeight:700 }}>
                  {A.selisihList.length} transaksi
                </span>
              </div>

              {A.selisihList.length===0 ? (
                <div style={{ padding:40, textAlign:"center", color:"#6b7280", fontSize:14 }}>✅ Tidak ada selisih ongkir.</div>
              ) : (
                <div style={{ padding:16, display:"flex", flexDirection:"column", gap:12 }}>
                  {A.selisihList.map((trx,i) => {
                    const rugi = trx.selisih > 0;
                    return (
                      <div key={i} style={{ border:`2px solid ${rugi?"#FEE2E2":"#DCFCE7"}`, borderRadius:14, overflow:"hidden" }}>
                        {/* Header */}
                        <div style={{ background:rugi?"#FEF2F2":"#F0FDF4", padding:"12px 16px", display:"flex", flexWrap:"wrap", gap:10, alignItems:"center", justifyContent:"space-between" }}>
                          <div style={{ display:"flex", gap:10, alignItems:"center", flexWrap:"wrap" }}>
                            <span style={{ fontWeight:800, fontSize:12, color:"#555", fontFamily:"monospace", background:"#e5e7eb", padding:"2px 8px", borderRadius:6 }}>{trx.orderId}</span>
                            <span style={{ background:"#fff", border:"1px solid #e5e7eb", borderRadius:99, padding:"2px 10px", fontSize:12, fontWeight:700, color:"#111" }}>
                              👤 {trx.username}
                            </span>
                            <span style={{ fontSize:12, color:"#6b7280" }}>
                              📍 {trx.kota}, {trx.provinsi}
                            </span>
                          </div>
                          {/* Angka rincian */}
                          <div style={{ display:"flex", gap:16, alignItems:"center", flexWrap:"wrap" }}>
                            <div style={{ textAlign:"center" }}>
                              <div style={{ fontSize:10, color:"#9ca3af", textTransform:"uppercase", letterSpacing:.5 }}>Perkiraan</div>
                              <div style={{ fontSize:13, fontWeight:700, color:"#374151" }}>{fmt(trx.perkiraanOngkir)}</div>
                            </div>
                            <div style={{ color:"#d1d5db", fontSize:16 }}>−</div>
                            <div style={{ textAlign:"center" }}>
                              <div style={{ fontSize:10, color:"#9ca3af", textTransform:"uppercase", letterSpacing:.5 }}>Dibayar</div>
                              <div style={{ fontSize:13, fontWeight:700, color:"#374151" }}>{fmt(trx.ongkirDibayar)}</div>
                            </div>
                            <div style={{ color:"#d1d5db", fontSize:16 }}>−</div>
                            <div style={{ textAlign:"center" }}>
                              <div style={{ fontSize:10, color:"#9ca3af", textTransform:"uppercase", letterSpacing:.5 }}>Potongan</div>
                              <div style={{ fontSize:13, fontWeight:700, color:"#374151" }}>{fmt(trx.ongkirPotongan)}</div>
                            </div>
                            <div style={{ color:"#d1d5db", fontSize:16 }}>=</div>
                            <div style={{ background:rugi?"#DC2626":"#16A34A", color:"#fff", borderRadius:10, padding:"6px 14px", textAlign:"center" }}>
                              <div style={{ fontSize:10, textTransform:"uppercase", letterSpacing:.5, opacity:.8 }}>{rugi?"Selisih Lebih":"Selisih Hemat"}</div>
                              <div style={{ fontSize:15, fontWeight:800 }}>{rugi?"▲":"▼"} {fmt(Math.abs(trx.selisih))}</div>
                            </div>
                          </div>
                        </div>

                        {/* Items */}
                        <div style={{ padding:"10px 16px 14px" }}>
                          <div style={{ fontSize:11, fontWeight:700, color:"#9ca3af", textTransform:"uppercase", letterSpacing:1, marginBottom:8 }}>Item dalam pesanan:</div>
                          <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
                            {trx.items.map((item,j) => (
                              <div key={j} style={{ display:"flex", alignItems:"center", gap:8, fontSize:13, color:"#374151" }}>
                                <span style={{ width:6, height:6, borderRadius:"50%", background:"#FF6B35", flexShrink:0 }}/>
                                <span style={{ flex:1, fontWeight:500 }}>{item.productName}</span>
                                <span style={{ background:"#FEF9C3", color:"#854D0E", borderRadius:6, padding:"1px 8px", fontSize:11, fontWeight:700, whiteSpace:"nowrap" }}>
                                  ⚖️ {item.beratProduk}
                                </span>
                                <span style={{ background:"#EFF6FF", color:"#1D4ED8", borderRadius:6, padding:"1px 8px", fontSize:11, fontWeight:700, whiteSpace:"nowrap" }}>
                                  ×{item.qty} pcs
                                </span>
                                <span style={{ background:"#F3F4F6", color:"#6b7280", borderRadius:6, padding:"1px 8px", fontSize:11, whiteSpace:"nowrap" }}>
                                  {item.category}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══ VOUCHER ══════════════════════════════════════════════════════ */}
        {tab==="voucher" && (
          <div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:16, marginBottom:24 }}>
              <StatCard icon={Ticket} label="Voucher Penjual"   value={`${A.voucherPenjualCount}x`} sub={fmt(A.totalVoucherPenjual)} color="#FF6B35"/>
              <StatCard icon={Ticket} label="Voucher Shopee"    value={`${A.voucherShopeeCount}x`}  sub={fmt(A.totalVoucherShopee)}  color="#004E89"/>
              <StatCard icon={Star}   label="Diskon Penjual"    value={fmt(data.reduce((s,r)=>s+r.diskonPenjual,0))} sub="Semua jenis diskon" color="#1A936F"/>
              <StatCard icon={Star}   label="Diskon Shopee"     value={fmt(data.reduce((s,r)=>s+r.diskonShopee,0))}  sub="Cashback & diskon"  color="#E84855"/>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:24 }}>
              <div style={{ background:"#fff", borderRadius:16, padding:24, boxShadow:"0 2px 12px rgba(0,0,0,.06)" }}>
                <h2 style={{ margin:"0 0 20px", fontSize:16, fontWeight:700 }}>🎟 Penggunaan Voucher per Kategori</h2>
                {(() => {
                  const cv={};
                  data.forEach(r=>{ if(r.voucherPenjual>0||r.voucherShopee>0) cv[r.category]=(cv[r.category]||0)+1; });
                  const cd=Object.entries(cv).map(([n,v])=>({name:n,value:v})).sort((a,b)=>b.value-a.value);
                  return (
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={cd}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false}/>
                        <XAxis dataKey="name" tick={{fontSize:10}} angle={-20} textAnchor="end" height={60}/>
                        <YAxis tick={{fontSize:11}}/>
                        <Tooltip content={<CustomTip/>}/>
                        <Bar dataKey="value" fill="#FF6B35" radius={[6,6,0,0]} name="Penggunaan"/>
                      </BarChart>
                    </ResponsiveContainer>
                  );
                })()}
              </div>
              <div style={{ background:"#fff", borderRadius:16, padding:24, boxShadow:"0 2px 12px rgba(0,0,0,.06)" }}>
                <h2 style={{ margin:"0 0 20px", fontSize:16, fontWeight:700 }}>💰 Nilai Voucher Penjual per Kategori</h2>
                {(() => {
                  const cv={};
                  data.forEach(r=>{ cv[r.category]=(cv[r.category]||0)+r.voucherPenjual; });
                  const cd=Object.entries(cv).filter(([,v])=>v>0).map(([n,v])=>({name:n,value:v})).sort((a,b)=>b.value-a.value);
                  return (
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={cd}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false}/>
                        <XAxis dataKey="name" tick={{fontSize:10}} angle={-20} textAnchor="end" height={60}/>
                        <YAxis tickFormatter={v=>"Rp"+(v/1e3).toFixed(0)+"K"} tick={{fontSize:11}}/>
                        <Tooltip content={<CustomTip/>}/>
                        <Bar dataKey="value" fill="#1A936F" radius={[6,6,0,0]} name="Total Voucher"/>
                      </BarChart>
                    </ResponsiveContainer>
                  );
                })()}
              </div>
            </div>
          </div>
        )}

        {/* ══ CATEGORY ══════════════════════════════════════════════════════ */}
        {tab==="category" && (
          <div>
            <div style={{ background:"#fff", borderRadius:16, padding:24, boxShadow:"0 2px 12px rgba(0,0,0,.06)", marginBottom:24 }}>
              <h2 style={{ margin:"0 0 20px", fontSize:16, fontWeight:700 }}>📦 Revenue per Kategori Produk</h2>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={catBarData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false}/>
                  <XAxis dataKey="name" tick={{fontSize:11}} angle={-15} textAnchor="end" height={70}/>
                  <YAxis tickFormatter={v=>"Rp"+(v/1e6).toFixed(1)+"M"} tick={{fontSize:11}}/>
                  <Tooltip content={<CustomTip/>}/>
                  <Bar dataKey="revenue" radius={[6,6,0,0]} name="Revenue" fill="#FF6B35"/>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:24, marginBottom:24 }}>
              <div style={{ background:"#fff", borderRadius:16, padding:24, boxShadow:"0 2px 12px rgba(0,0,0,.06)" }}>
                <h2 style={{ margin:"0 0 20px", fontSize:16, fontWeight:700 }}>Jumlah Pesanan per Kategori</h2>
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={catBarData.map(c=>({name:c.name,value:c.orders}))} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value" paddingAngle={3}>
                      {catBarData.map((_,i)=><Cell key={i} fill={PALETTE[i%PALETTE.length]}/>)}
                    </Pie>
                    <Tooltip/><Legend iconSize={10} wrapperStyle={{fontSize:11}}/>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div style={{ background:"#fff", borderRadius:16, padding:24, boxShadow:"0 2px 12px rgba(0,0,0,.06)" }}>
                <h2 style={{ margin:"0 0 20px", fontSize:16, fontWeight:700 }}>Total Unit Terjual per Kategori</h2>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={catBarData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={false}/>
                    <XAxis type="number" tick={{fontSize:11}}/>
                    <YAxis type="category" dataKey="name" width={140} tick={{fontSize:11}}/>
                    <Tooltip content={<CustomTip/>}/>
                    <Bar dataKey="qty" fill="#004E89" radius={[0,6,6,0]} name="Unit"/>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div style={{ background:"#fff", borderRadius:16, overflow:"hidden", boxShadow:"0 2px 12px rgba(0,0,0,.06)" }}>
              <table style={{ width:"100%", borderCollapse:"collapse" }}>
                <thead style={{ background:"#f9fafb" }}>
                  <tr>{["Kategori","Pesanan","Unit Terjual","Total Revenue","Avg/Pesanan"].map(h=>(
                    <th key={h} style={{ padding:"12px 16px", textAlign:"left", fontSize:12, fontWeight:700, color:"#6b7280", textTransform:"uppercase", letterSpacing:.5 }}>{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {catBarData.map((c,i)=>(
                    <tr key={i} style={{ borderTop:"1px solid #f3f4f6" }}>
                      <td style={{ padding:"12px 16px", fontSize:13, fontWeight:600, color:"#111" }}>
                        <span style={{ display:"inline-block", width:10, height:10, borderRadius:"50%", background:PALETTE[i%PALETTE.length], marginRight:8 }}/>
                        {c.name}
                      </td>
                      <td style={{ padding:"12px 16px", fontSize:13, color:"#374151" }}>{c.orders}</td>
                      <td style={{ padding:"12px 16px", fontSize:13, color:"#374151" }}>{c.qty}</td>
                      <td style={{ padding:"12px 16px", fontSize:13, fontWeight:700, color:"#FF6B35" }}>{fmt(c.revenue)}</td>
                      <td style={{ padding:"12px 16px", fontSize:13, color:"#374151" }}>{fmt(c.revenue/c.orders)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ══ USERS ══════════════════════════════════════════════════════════ */}
        {tab==="users" && (
          <div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:16, marginBottom:24 }}>
              <StatCard icon={Users}      label="Pembeli Unik"     value={A.uniqueUsers} color="#004E89"/>
              <StatCard icon={Star}       label="Top Buyer"        value={filteredUsers[0]?.username||"-"} sub={fmt(filteredUsers[0]?.total||0)} color="#FF6B35"/>
              <StatCard icon={ShoppingBag} label="Rata-rata Pesanan" value={(A.totalOrders/A.uniqueUsers).toFixed(1)+"x"} sub="Per user" color="#1A936F"/>
            </div>

            <div style={{ display:"flex", gap:12, marginBottom:16, alignItems:"center" }}>
              <div style={{ position:"relative", flex:1 }}>
                <Search size={16} style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", color:"#9ca3af" }}/>
                <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cari username..."
                  style={{ width:"100%", padding:"10px 12px 10px 36px", border:"1px solid #e5e7eb", borderRadius:10, fontSize:13, outline:"none", boxSizing:"border-box" }}/>
              </div>
              <span style={{ fontSize:12, color:"#6b7280" }}>{filteredUsers.length} user</span>
            </div>

            <div style={{ background:"#fff", borderRadius:16, overflow:"hidden", boxShadow:"0 2px 12px rgba(0,0,0,.06)" }}>
              <div style={{ overflowX:"auto" }}>
                <table style={{ width:"100%", borderCollapse:"collapse" }}>
                  <thead style={{ background:"#f9fafb" }}>
                    <tr>
                      {[
                        {label:"#",key:null},{label:"Username",key:null},
                        {label:"Pesanan",key:"orderCount"},{label:"Total Item",key:"items"},
                        {label:"Total Belanja",key:"total"},{label:"Avg/Pesanan",key:"avgPerOrder"},
                        {label:"Pakai Voucher",key:"vouchers"},{label:"Fav Kategori",key:null},
                      ].map((h,i)=>(
                        <th key={i} onClick={h.key?()=>toggleSort(h.key):undefined}
                          style={{ padding:"12px 16px", textAlign:"left", fontSize:12, fontWeight:700, color:"#6b7280", textTransform:"uppercase", letterSpacing:.5, cursor:h.key?"pointer":"default", userSelect:"none", whiteSpace:"nowrap" }}>
                          {h.label}{h.key&&sortKey===h.key&&(sortDir==="desc"?<ChevronDown size={12} style={{display:"inline"}}/>:<ChevronUp size={12} style={{display:"inline"}}/>)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.slice(0,100).map((u,i)=>(
                      <tr key={i} style={{ borderTop:"1px solid #f3f4f6", background:i%2===0?"#fff":"#fafafa" }}>
                        <td style={{ padding:"10px 16px", fontSize:12, color:"#9ca3af" }}>{i+1}</td>
                        <td style={{ padding:"10px 16px", fontSize:13, fontWeight:700, color:"#111" }}>
                          {i<3&&<span style={{marginRight:6}}>{["🥇","🥈","🥉"][i]}</span>}{u.username}
                        </td>
                        <td style={{ padding:"10px 16px", fontSize:13, fontWeight:600, color:"#374151" }}>{u.orderCount}x</td>
                        <td style={{ padding:"10px 16px", fontSize:13, color:"#374151" }}>{u.items}</td>
                        <td style={{ padding:"10px 16px", fontSize:13, fontWeight:700, color:"#FF6B35" }}>{fmt(u.total)}</td>
                        <td style={{ padding:"10px 16px", fontSize:13, color:"#374151" }}>{fmt(u.avgPerOrder)}</td>
                        <td style={{ padding:"10px 16px", fontSize:13, color:u.vouchers>0?"#1A936F":"#d1d5db", fontWeight:u.vouchers>0?700:400 }}>
                          {u.vouchers>0?`✓ ${u.vouchers}x`:"-"}
                        </td>
                        <td style={{ padding:"10px 16px" }}>
                          <span style={{ background:"#f3f4f6", borderRadius:99, padding:"3px 10px", fontSize:11, color:"#374151", fontWeight:600 }}>{u.topCategory}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filteredUsers.length>100&&<div style={{ padding:16, textAlign:"center", color:"#6b7280", fontSize:13 }}>Menampilkan 100 dari {filteredUsers.length} user.</div>}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
