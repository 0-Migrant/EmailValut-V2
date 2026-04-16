// ═══════════════════════════════════════════════════════════
//  STATE
// ═══════════════════════════════════════════════════════════
let state = {
  items: [],        // {id, name, price, category}
  categories: [],   // ['Food','Drinks','Sides'] — Feature 4: managed list
  deliveryMen: [],  // {id, name}  — Feature 5: phone removed
  orders: [],       // {id, deliveryManId, customerId, items:[{itemId,qty,price}], status, note, customPrice, createdAt}
  credentials: [],  // {id, name, email, pass, stocks, added}
  history: [],
  settings: { showpass:false, confirmdelete:true, rowsperpage:25, historyretention:30, historylimit:200 }
};

let currentPage = 'dashboard';
let confirmCb = null;
let editingId = null;
let expandedIds = new Set();
let editingStockId = null;

// Order builder state — Feature 2: customerId; Feature 1: customPrice
let orderBuilder = { deliveryManId:'', customerId:'', items:[], note:'', customPrice:'' };

function load() {
  try { state = {...state, ...JSON.parse(localStorage.getItem('vault_state')||'{}')} } catch(e){}
  if (!state.items) state.items = [];
  if (!state.categories) state.categories = [];
  if (!state.deliveryMen) state.deliveryMen = [];
  if (!state.orders) state.orders = [];
  if (!state.credentials) state.credentials = [];
  if (!state.history) state.history = [];
  if (!state.settings) state.settings = { showpass:false, confirmdelete:true, rowsperpage:25, historyretention:30, historylimit:200 };
  state.credentials.forEach(c => { if(!c.stocks) c.stocks=[] });

  // Seed sample data if empty
  if (!state.categories.length) {
    state.categories = ['Food','Drinks','Sides'];
  }
  if (!state.items.length) {
    state.items = [
      {id:uid(),name:'Burger',price:45,category:'Food'},
      {id:uid(),name:'Pizza',price:80,category:'Food'},
      {id:uid(),name:'Shawarma',price:35,category:'Food'},
      {id:uid(),name:'Fries',price:20,category:'Sides'},
      {id:uid(),name:'Cola',price:15,category:'Drinks'},
      {id:uid(),name:'Water',price:8,category:'Drinks'},
      {id:uid(),name:'Juice',price:18,category:'Drinks'},
    ];
  }
  if (!state.deliveryMen.length) {
    state.deliveryMen = [
      {id:uid(),name:'Ahmed Hassan'},
      {id:uid(),name:'Mohamed Ali'},
    ];
  }
  pruneHistory();
  applySettingsUI();
  navigate(currentPage);
}

function persist() {
  localStorage.setItem('vault_state', JSON.stringify(state));
}

function uid() { return Date.now().toString(36)+Math.random().toString(36).slice(2) }

function esc(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function fmt(n) { return Number(n||0).toLocaleString('en-EG',{minimumFractionDigits:2,maximumFractionDigits:2}); }
function fmtDate(iso) { return new Date(iso).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}); }
function fmtTime(iso) { return new Date(iso).toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit'}); }
function fmtDateTime(iso) { return fmtDate(iso)+' '+fmtTime(iso); }

function addHist(type, msg, snap) {
  state.history.unshift({id:uid(),type,msg,time:new Date().toISOString(),snapshot:snap||JSON.stringify(state)});
  if (state.history.length > state.settings.historylimit) state.history = state.history.slice(0,state.settings.historylimit);
}

function pruneHistory() {
  if (!state.settings.historyretention) return;
  const cutoff = Date.now() - state.settings.historyretention*86400000;
  state.history = state.history.filter(h => new Date(h.time).getTime() > cutoff);
}

// ═══════════════════════════════════════════════════════════
//  NAVIGATION
// ═══════════════════════════════════════════════════════════
const pages = {
  dashboard, 'new-order':newOrder, orders:ordersPage, analytics:analyticsPage,
  items:itemsPage, delivery:deliveryPage, credentials:credentialsPage,
  history:historyPage, settings:settingsPage
};

function navigate(name) {
  currentPage = name;
  // Close mobile sidebar on navigation
  closeMobileSidebar();
  document.querySelectorAll('.nav-item').forEach((b,i) => {
    const names = ['dashboard','new-order','orders','analytics','items','delivery','credentials','history','settings'];
    b.classList.toggle('active', names[i]===name);
  });
  const pc = document.getElementById('page-content');
  pc.innerHTML = '';
  if (pages[name]) pages[name]();
}

// ═══════════════════════════════════════════════════════════
//  DASHBOARD — Feature 6: read-only, no action buttons
// ═══════════════════════════════════════════════════════════
function dashboard() {
  const pc = document.getElementById('page-content');
  const today = new Date().toDateString();
  const todayOrders = state.orders.filter(o=>new Date(o.createdAt).toDateString()===today);
  const todayRevenue = todayOrders.filter(o=>o.status==='done').reduce((a,o)=>a+orderTotal(o),0);
  // Feature 7: pending includes both 'waiting' and 'pending'
  const pending = state.orders.filter(o=>o.status==='pending'||o.status==='waiting');
  const totalRevenue = state.orders.filter(o=>o.status==='done').reduce((a,o)=>a+orderTotal(o),0);
  const weekOrders = state.orders.filter(o=>{const d=new Date(o.createdAt);const now=new Date();return (now-d)<7*86400000;});

  // Top items
  const itemCounts={};
  state.orders.filter(o=>o.status==='done').forEach(o=>o.items.forEach(it=>{itemCounts[it.itemId]=(itemCounts[it.itemId]||0)+it.qty}));
  const topItems = Object.entries(itemCounts).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([id,qty])=>({item:state.items.find(i=>i.id===id),qty})).filter(x=>x.item);

  // Delivery performance
  const dmRevenue={};
  state.orders.filter(o=>o.status==='done').forEach(o=>{dmRevenue[o.deliveryManId]=(dmRevenue[o.deliveryManId]||0)+orderTotal(o)});

  pc.innerHTML = `
  <div class="section-title">📊 Dashboard Overview</div>
  <div class="grid-4" style="margin-bottom:20px">
    <div class="stat-card">
      <div class="stat-label">Today Revenue</div>
      <div class="stat-value">${fmt(todayRevenue)} $ USD</div>
      <div class="stat-sub">${todayOrders.filter(o=>o.status==='done').length} orders delivered</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Waiting / Pending</div>
      <div class="stat-value" style="color:var(--orange)">${pending.length}</div>
      <div class="stat-sub">Awaiting action</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">This Week Orders</div>
      <div class="stat-value">${weekOrders.length}</div>
      <div class="stat-sub">${weekOrders.filter(o=>o.status==='done').length} completed</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Total Revenue</div>
      <div class="stat-value" style="color:var(--green)">${fmt(totalRevenue)} $ USD</div>
      <div class="stat-sub">All time</div>
    </div>
  </div>
  <div class="grid-2" style="margin-bottom:20px">
    <div class="card">
      <div class="card-title">🏆 Top Selling Items</div>
      ${topItems.length ? topItems.map(x=>`
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border-row)">
          <span style="font-size:13px;font-weight:500">${esc(x.item.name)}</span>
          <span class="badge badge-info">×${x.qty}</span>
        </div>`).join('') : '<div class="empty-state" style="padding:20px 0"><div class="empty-icon">📦</div>No sales yet</div>'}
    </div>
    <div class="card">
      <div class="card-title">🚚 Delivery Performance</div>
      ${state.deliveryMen.length ? state.deliveryMen.map(dm=>{
        const rev = dmRevenue[dm.id]||0;
        const cnt = state.orders.filter(o=>o.deliveryManId===dm.id&&o.status==='done').length;
        return `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border-row)">
          <div><div style="font-size:13px;font-weight:500">${esc(dm.name)}</div><div style="font-size:11px;color:var(--text-hint)">${cnt} deliveries</div></div>
          <span style="font-size:13px;font-weight:700;color:var(--green)">${fmt(rev)} $ USD</span>
        </div>`;
      }).join('') : '<div class="empty-state" style="padding:20px 0"><div class="empty-icon">🚚</div>No delivery men added</div>'}
    </div>
  </div>
  <div class="card" style="margin-bottom:20px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
      <div class="card-title" style="margin:0">⏳ Waiting / Pending Orders — Quick View</div>
      <button class="btn btn-ghost btn-sm" onclick="navigate('orders')">Manage Orders →</button>
    </div>
    ${pending.length ? `<div class="table-wrap"><table>
      <thead><tr><th>#</th><th>Customer</th><th>Delivery Man</th><th>Items</th><th>Total</th><th>Status</th><th>Time</th></tr></thead>
      <tbody>${pending.slice(0,8).map(o=>{
        const dm = state.deliveryMen.find(d=>d.id===o.deliveryManId);
        const badgeClass = o.status==='waiting'?'badge-waiting':'badge-pending';
        return `<tr>
          <td><span class="tag">${o.id.slice(-5)}</span></td>
          <td style="color:var(--text-muted);font-size:12px">${esc(o.customerId||'—')}</td>
          <td style="font-weight:500">${esc(dm?dm.name:'Unknown')}</td>
          <td style="color:var(--text-muted)">${o.items.length} item(s)</td>
          <td style="font-weight:700;color:var(--accent)">${fmt(orderTotal(o))} $ USD</td>
          <td><span class="badge ${badgeClass}">${o.status}</span></td>
          <td><span class="tag">${fmtTime(o.createdAt)}</span></td>
        </tr>`;
      }).join('')}</tbody>
    </table></div>` : '<div class="empty-state" style="padding:20px 0"><div class="empty-icon">✅</div>No pending orders</div>'}
  </div>
  <div class="grid-3">
    <div class="stat-card" style="cursor:pointer" onclick="navigate('items')">
      <div class="stat-label">Total Items</div>
      <div class="stat-value">${state.items.length}</div>
      <div class="stat-sub" style="color:var(--accent)">Manage →</div>
    </div>
    <div class="stat-card" style="cursor:pointer" onclick="navigate('delivery')">
      <div class="stat-label">Delivery Men</div>
      <div class="stat-value">${state.deliveryMen.length}</div>
      <div class="stat-sub" style="color:var(--accent)">Manage →</div>
    </div>
    <div class="stat-card" style="cursor:pointer" onclick="navigate('credentials')">
      <div class="stat-label">Credentials</div>
      <div class="stat-value">${state.credentials.length}</div>
      <div class="stat-sub" style="color:var(--accent)">Manage →</div>
    </div>
  </div>`;
}

// ═══════════════════════════════════════════════════════════
//  NEW ORDER
//  Feature 1: Custom price + discount display
//  Feature 2: Customer ID field
//  Feature 5: Price List sidebar removed
// ═══════════════════════════════════════════════════════════
function newOrder() {
  const pc = document.getElementById('page-content');
  orderBuilder = { deliveryManId:'', customerId:'', items:[], customPrice:'' };

  // Group items by category for display
  const cats = [...new Set(state.items.map(i=>i.category||'Other'))].sort();

  pc.innerHTML = `
  <div class="section-title">➕ New Order</div>
  <div style="max-width:720px;display:flex;flex-direction:column;gap:16px">
    <!-- Delivery Details -->
    <div class="card">
      <div class="card-title">Delivery Details</div>
      <div class="new-order-fields">
        <div class="field">
          <label>Delivery Man</label>
          <select class="inp" id="ob-dm" onchange="orderBuilder.deliveryManId=this.value">
            <option value="">— Select delivery man —</option>
            ${state.deliveryMen.map(d=>`<option value="${d.id}">${esc(d.name)}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label>Customer ID <span style="font-size:11px;color:var(--text-hint)">(optional — for loyalty tracking)</span></label>
          <input class="inp" id="ob-customer" type="text" placeholder="e.g. CUST-001" oninput="orderBuilder.customerId=this.value">
        </div>
      </div>
    </div>

    <!-- Order Items -->
    <div class="card">
      <div class="card-title">Order Items</div>
      <div id="ob-items-list" class="order-items-list"></div>
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
        <select class="inp" id="ob-item-sel" style="flex:1" onchange="obAddItem()">
          <option value="">+ Add item to order...</option>
          ${cats.map(cat=>`
            <optgroup label="${esc(cat)}">
              ${state.items.filter(it=>(it.category||'Other')===cat).map(it=>`<option value="${it.id}">${esc(it.name)} — ${fmt(it.price)} $ USD</option>`).join('')}
            </optgroup>`).join('')}
        </select>
      </div>
      <hr class="divider">
      <div id="ob-total-section">
        <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0">
          <span style="font-size:13px;color:var(--text-muted)">Items Total</span>
          <span id="ob-items-total" style="font-size:15px;font-weight:600;color:var(--text-main)">0.00 $ USD</span>
        </div>
        <div class="field" style="margin:10px 0">
          <label>Custom Price <span style="font-size:11px;color:var(--text-hint)">(optional — overrides items total)</span></label>
          <input class="inp" id="ob-custom-price" type="number" min="0" step="0.01" placeholder="0.00" oninput="obUpdateDiscount()">
        </div>
        <!-- Discount info (custom < items total) -->
        <div id="ob-discount-info" style="display:none;background:var(--green-bg);border:1px solid var(--green-border);border-radius:8px;padding:10px;margin-bottom:8px">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <span style="font-size:13px;color:var(--green);font-weight:600">🏷 Discount Applied</span>
            <span id="ob-discount-pct" style="font-size:13px;font-weight:700;color:var(--green)"></span>
          </div>
          <div style="display:flex;justify-content:space-between;margin-top:6px;font-size:12px;color:var(--text-muted)">
            <span>Customer saves:</span>
            <span id="ob-discount-amt" style="font-weight:600;color:var(--green)"></span>
          </div>
        </div>
        <!-- Surcharge info (custom > items total) -->
        <div id="ob-surcharge-info" style="display:none;background:var(--orange-bg);border:1px solid var(--orange-border);border-radius:8px;padding:10px;margin-bottom:8px">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <span style="font-size:13px;color:var(--orange);font-weight:600">📈 Custom Price (Above Items Total)</span>
            <span id="ob-surcharge-pct" style="font-size:13px;font-weight:700;color:var(--orange)"></span>
          </div>
          <div style="display:flex;justify-content:space-between;margin-top:6px;font-size:12px;color:var(--text-muted)">
            <span>Extra above items:</span>
            <span id="ob-surcharge-amt" style="font-weight:600;color:var(--orange)"></span>
          </div>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px">
          <span style="font-size:14px;font-weight:600;color:var(--text-muted)">Order Total</span>
          <span id="ob-total" style="font-size:20px;font-weight:700;color:var(--accent)">0.00 $ USD</span>
        </div>
      </div>
      <button class="btn btn-primary" style="width:100%;margin-top:14px;height:42px;font-size:15px" onclick="submitOrder()">🚀 Place Order</button>
    </div>
  </div>`;

  renderObItems();
}

function obUpdateDiscount() {
  const customPriceVal = document.getElementById('ob-custom-price')?.value.trim();
  const customPrice = customPriceVal !== '' ? parseFloat(customPriceVal) : NaN;
  const itemsTotal = orderBuilder.items.reduce((a,oi)=>a+oi.price*oi.qty,0);
  const discountInfo   = document.getElementById('ob-discount-info');
  const surchargeInfo  = document.getElementById('ob-surcharge-info');
  const totalEl        = document.getElementById('ob-total');

  orderBuilder.customPrice = customPriceVal;

  // Hide both by default
  if (discountInfo)  discountInfo.style.display  = 'none';
  if (surchargeInfo) surchargeInfo.style.display = 'none';

  if (!isNaN(customPrice) && customPrice >= 0) {
    // Custom price is set — always use it as the order total
    if (totalEl) totalEl.textContent = fmt(customPrice) + ' $ USD';

    if (itemsTotal > 0 && customPrice < itemsTotal) {
      // DISCOUNT: custom price is lower than items total
      const saved = itemsTotal - customPrice;
      const pct   = (saved / itemsTotal * 100).toFixed(1);
      if (discountInfo) {
        discountInfo.style.display = '';
        document.getElementById('ob-discount-pct').textContent = `-${pct}%`;
        document.getElementById('ob-discount-amt').textContent = `${fmt(saved)} $ USD`;
      }
    } else if (itemsTotal > 0 && customPrice > itemsTotal) {
      // SURCHARGE: custom price is higher than items total
      const extra = customPrice - itemsTotal;
      const pct   = (extra / itemsTotal * 100).toFixed(1);
      if (surchargeInfo) {
        surchargeInfo.style.display = '';
        document.getElementById('ob-surcharge-pct').textContent = `+${pct}%`;
        document.getElementById('ob-surcharge-amt').textContent = `${fmt(extra)} $ USD`;
      }
    }
    // If customPrice === itemsTotal: no badge, just show the total normally
  } else {
    // No custom price set — fall back to items total
    if (totalEl) totalEl.textContent = fmt(itemsTotal) + ' $ USD';
  }
}

function obAddItem() {
  const sel = document.getElementById('ob-item-sel');
  const itemId = sel?.value; if(!itemId) return;
  const item = state.items.find(i=>i.id===itemId); if(!item) return;
  const existing = orderBuilder.items.find(x=>x.itemId===itemId);
  if (existing) { existing.qty++; } else { orderBuilder.items.push({itemId,qty:1,price:item.price}); }
  sel.value='';
  renderObItems(); obUpdateDiscount();
}

function renderObItems() {
  const listEl = document.getElementById('ob-items-list');
  const totalEl = document.getElementById('ob-items-total');
  if (!listEl) return;
  if (!orderBuilder.items.length) {
    listEl.innerHTML=`<div style="font-size:13px;color:var(--text-hint);text-align:center;padding:16px">Use the dropdown to add items to the order.</div>`;
    if(totalEl) totalEl.textContent='0.00 $ USD';
    return;
  }
  let total=0;
  listEl.innerHTML = orderBuilder.items.map(oi=>{
    const item = state.items.find(i=>i.id===oi.itemId);
    if (!item) return '';
    const sub = oi.price * oi.qty; total+=sub;
    return `<div class="order-item-row">
      <div class="item-label">${esc(item.name)}</div>
      <input class="inp" type="number" min="1" value="${oi.qty}" style="height:28px;font-size:12px" onchange="obChangeQty('${oi.itemId}',this.value)">
      <div>
        <div style="font-size:10px;color:var(--text-hint)">@ ${fmt(oi.price)}</div>
        <div class="item-subtotal">${fmt(sub)} $ USD</div>
      </div>
      <button class="btn btn-danger btn-xs btn-icon" onclick="obRemoveItem('${oi.itemId}')" title="Remove">✕</button>
    </div>`;
  }).join('');
  if(totalEl) totalEl.textContent=fmt(total)+' $ USD';
  obUpdateDiscount();
}

function obChangeQty(itemId, val) {
  const qty=Math.max(1,parseInt(val)||1);
  const oi=orderBuilder.items.find(x=>x.itemId===itemId);
  if(oi){oi.qty=qty;renderObItems();}
}

function obRemoveItem(itemId) {
  orderBuilder.items = orderBuilder.items.filter(x=>x.itemId!==itemId);
  renderObItems();
}

function submitOrder() {
  const dmId = document.getElementById('ob-dm')?.value;
  const customerId = document.getElementById('ob-customer')?.value.trim()||'';
  const customPriceVal = document.getElementById('ob-custom-price')?.value.trim();
  const customPrice = (customPriceVal !== '' && !isNaN(parseFloat(customPriceVal))) ? parseFloat(customPriceVal) : null;

  if (!dmId) { alert('Please select a delivery man.'); return; }
  if (!orderBuilder.items.length) { alert('Please add at least one item.'); return; }

  const snap = JSON.stringify(state);
  const order = {
    id:uid(), deliveryManId:dmId, customerId,
    items:JSON.parse(JSON.stringify(orderBuilder.items)),
    status:'waiting',
    customPrice,
    createdAt:new Date().toISOString()
  };

  // Feature 3: Loyalty check — every 10 purchases for same customerId
  if (customerId) {
    const prevCount = state.orders.filter(o=>o.customerId===customerId).length;
    if ((prevCount + 1) % 10 === 0) {
      state.orders.unshift(order);
      const dm=state.deliveryMen.find(d=>d.id===dmId);
      addHist('add',`New order placed via ${dm?dm.name:'?'} — ${order.items.length} items — ${fmt(orderTotal(order))} $ USD`,snap);
      persist();
      showLoyaltyModal(customerId, prevCount + 1);
      return;
    }
  }

  state.orders.unshift(order);
  const dm=state.deliveryMen.find(d=>d.id===dmId);
  addHist('add',`New order placed via ${dm?dm.name:'?'} — ${order.items.length} items — ${fmt(orderTotal(order))} $ USD`,snap);
  persist();
  alert('✅ Order placed! Status: Waiting for accept.');
  navigate('orders');
}

// Feature 3: Loyalty modal
function showLoyaltyModal(customerId, orderNum) {
  document.getElementById('loyalty-customer').textContent = customerId;
  document.getElementById('loyalty-order-num').textContent = orderNum;
  document.getElementById('loyalty-modal').style.display = '';
}
function closeLoyaltyModal(goToOrders) {
  document.getElementById('loyalty-modal').style.display = 'none';
  if (goToOrders) navigate('orders');
  else navigate('orders');
}

// Feature 1: orderTotal uses customPrice if set
function orderTotal(order) {
  if (order.customPrice !== null && order.customPrice !== undefined && order.customPrice >= 0) {
    return order.customPrice;
  }
  return orderItemsTotal(order);
}

function orderItemsTotal(order) {
  return (order.items||[]).reduce((a,oi)=>a+oi.price*oi.qty,0);
}

function orderDiscountInfo(order) {
  const itemsTotal = orderItemsTotal(order);
  if (order.customPrice !== null && order.customPrice !== undefined && order.customPrice >= 0 && order.customPrice < itemsTotal) {
    const saved = itemsTotal - order.customPrice;
    const pct = (saved / itemsTotal * 100).toFixed(1);
    return { hasDiscount:true, saved, pct, itemsTotal };
  }
  return { hasDiscount:false };
}

// ═══════════════════════════════════════════════════════════
//  MANAGE ORDERS
//  Feature 7: waiting→pending→done status flow
//  Feature 1: discount badge
//  Feature 2: customer ID column
// ═══════════════════════════════════════════════════════════
function ordersPage() {
  const pc = document.getElementById('page-content');
  pc.innerHTML = `
  <div class="section-title">📋 Manage Orders</div>
  <div class="flex-row" style="margin-bottom:16px;flex-wrap:wrap;gap:8px">
    <input class="search-box" id="ord-search" type="text" placeholder="Search by customer, delivery man..." oninput="renderOrdersTable()" style="min-width:200px;flex:1">
    <select class="inp" id="ord-filter" onchange="renderOrdersTable()" style="width:160px">
      <option value="all">All Orders</option>
      <option value="waiting">Waiting</option>
      <option value="pending">Pending</option>
      <option value="done">Done</option>
      <option value="cancelled">Cancelled</option>
    </select>
    <select class="inp" id="ord-dm-filter" onchange="renderOrdersTable()" style="width:180px">
      <option value="">All Delivery Men</option>
      ${state.deliveryMen.map(d=>`<option value="${d.id}">${esc(d.name)}</option>`).join('')}
    </select>
    <button class="btn btn-ghost btn-sm" onclick="exportOrdersPDF()">⬇ Export PDF</button>
  </div>
  <div class="card">
    <div id="orders-table-wrap"></div>
  </div>`;
  renderOrdersTable();
}

function renderOrdersTable() {
  const q=(document.getElementById('ord-search')?.value||'').toLowerCase();
  const filter=document.getElementById('ord-filter')?.value||'all';
  const dmF=document.getElementById('ord-dm-filter')?.value||'';
  let orders=state.orders.filter(o=>{
    const dm=state.deliveryMen.find(d=>d.id===o.deliveryManId);
    const matchQ=!q||
      (dm&&dm.name.toLowerCase().includes(q))||
      (o.customerId&&o.customerId.toLowerCase().includes(q))||
      (o.id.toLowerCase().includes(q));
    const matchS=filter==='all'||o.status===filter;
    const matchDm=!dmF||o.deliveryManId===dmF;
    return matchQ&&matchS&&matchDm;
  });
  const wrap=document.getElementById('orders-table-wrap');
  if(!wrap)return;
  if(!orders.length){wrap.innerHTML='<div class="empty-state"><div class="empty-icon">📋</div>No orders found.</div>';return;}
  wrap.innerHTML=`<div class="table-wrap"><table>
    <thead><tr><th>#</th><th>Customer</th><th>Delivery Man</th><th>Items</th><th>Total</th><th>Status</th><th>Date</th><th>Actions</th></tr></thead>
    <tbody>${orders.map(o=>{
      const dm=state.deliveryMen.find(d=>d.id===o.deliveryManId);
      const badgeClass=o.status==='done'?'badge-done':o.status==='cancelled'?'badge-cancelled':o.status==='waiting'?'badge-waiting':'badge-pending';
      const disc = orderDiscountInfo(o);
      const totalDisplay = disc.hasDiscount
        ? `<div style="font-size:11px;text-decoration:line-through;color:var(--text-hint)">${fmt(disc.itemsTotal)}</div>
           <div style="font-weight:700;color:var(--accent)">${fmt(orderTotal(o))} $ USD</div>
           <span class="discount-badge">🏷 -${disc.pct}%</span>`
        : `<span style="font-weight:700;color:var(--accent)">${fmt(orderTotal(o))} $ USD</span>`;
      return `<tr>
        <td><span class="tag">${o.id.slice(-5)}</span></td>
        <td style="font-size:12px;color:var(--text-muted)">${esc(o.customerId||'—')}</td>
        <td style="font-weight:500">${esc(dm?dm.name:'Unknown')}</td>
        <td style="color:var(--text-muted)">${o.items.map(oi=>{const it=state.items.find(i=>i.id===oi.itemId);return it?esc(it.name):'?';}).join(', ')}</td>
        <td>${totalDisplay}</td>
        <td><span class="badge ${badgeClass}">${o.status}</span></td>
        <td><span class="tag">${fmtDateTime(o.createdAt)}</span></td>
        <td><div class="action-group">
          ${o.status==='waiting'?`
            <button class="btn btn-success btn-xs" onclick="setOrderStatus('${o.id}','pending')">✓ Accept</button>
            <button class="btn btn-danger btn-xs" onclick="setOrderStatus('${o.id}','cancelled')">✗ Cancel</button>`:''}
          ${o.status==='pending'?`
            <button class="btn btn-success btn-xs" onclick="setOrderStatus('${o.id}','done')">✓ Done</button>
            <button class="btn btn-danger btn-xs" onclick="setOrderStatus('${o.id}','cancelled')">✗ Cancel</button>`:''}
          ${(o.status==='done'||o.status==='cancelled')?`
            <button class="btn btn-ghost btn-xs" onclick="setOrderStatus('${o.id}','waiting')">↩ Reset</button>`:''}
          <button class="btn btn-ghost btn-xs" onclick="viewOrder('${o.id}')">View</button>
          <button class="btn btn-danger btn-xs" onclick="deleteOrder('${o.id}')">🗑</button>
        </div></td>
      </tr>`;
    }).join('')}</tbody>
  </table></div>`;
}

function setOrderStatus(id, status) {
  const o=state.orders.find(x=>x.id===id); if(!o)return;
  const snap=JSON.stringify(state);
  o.status=status;
  addHist('edit',`Order ${id.slice(-5)} marked as ${status}`,snap);
  persist();
  if(currentPage==='orders') renderOrdersTable();
  else if(currentPage==='dashboard') dashboard();
}

function deleteOrder(id) {
  const doIt=()=>{
    const snap=JSON.stringify(state);
    state.orders=state.orders.filter(o=>o.id!==id);
    addHist('del',`Deleted order ${id.slice(-5)}`,snap);
    persist();
    renderOrdersTable();
  };
  if(state.settings.confirmdelete) showConfirm('Delete order','Permanently delete this order?',doIt);
  else doIt();
}

function viewOrder(id) {
  const o=state.orders.find(x=>x.id===id); if(!o)return;
  const dm=state.deliveryMen.find(d=>d.id===o.deliveryManId);
  const badgeClass=o.status==='done'?'badge-done':o.status==='cancelled'?'badge-cancelled':o.status==='waiting'?'badge-waiting':'badge-pending';
  const disc = orderDiscountInfo(o);
  document.getElementById('order-detail-body').innerHTML=`
    <h3>Order #${o.id.slice(-5)}</h3>
    <p style="margin-bottom:14px">${fmtDateTime(o.createdAt)}</p>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px">
      <div>
        <div style="font-size:12px;color:var(--text-hint);margin-bottom:4px">Delivery Man</div>
        <div style="font-weight:600">${esc(dm?dm.name:'Unknown')}</div>
      </div>
      <div>
        <div style="font-size:12px;color:var(--text-hint);margin-bottom:4px">Customer ID</div>
        <div style="font-weight:600">${esc(o.customerId||'—')}</div>
      </div>
    </div>
    <div style="margin-bottom:14px">
      <div style="font-size:12px;color:var(--text-hint);margin-bottom:6px">Items</div>
      ${o.items.map(oi=>{
        const it=state.items.find(i=>i.id===oi.itemId);
        return `<div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--border-row)">
          <span>${esc(it?it.name:'?')} × ${oi.qty}</span>
          <span style="font-weight:600">${fmt(oi.price*oi.qty)} $ USD</span>
        </div>`;
      }).join('')}
      <div style="display:flex;justify-content:space-between;padding:10px 0;font-size:13px;color:var(--text-muted)">
        <span>Items Total</span><span>${fmt(orderItemsTotal(o))} $ USD</span>
      </div>
      ${disc.hasDiscount?`
      <div style="background:var(--green-bg);border:1px solid var(--green-border);border-radius:8px;padding:10px;margin-bottom:8px">
        <div style="display:flex;justify-content:space-between">
          <span style="color:var(--green);font-weight:600;font-size:13px">🏷 Discount</span>
          <span style="color:var(--green);font-weight:700">-${disc.pct}%</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text-muted);margin-top:4px">
          <span>Saved:</span><span style="color:var(--green);font-weight:600">${fmt(disc.saved)} $ USD</span>
        </div>
      </div>`:''}
      <div style="display:flex;justify-content:space-between;padding:10px 0;font-weight:700;font-size:15px">
        <span>Total</span><span style="color:var(--accent)">${fmt(orderTotal(o))} $ USD</span>
      </div>
    </div>
    ${o.note?`<div style="margin-bottom:14px"><div style="font-size:12px;color:var(--text-hint);margin-bottom:4px">Note</div><div>${esc(o.note)}</div></div>`:''}
    <div style="margin-bottom:14px"><span class="badge ${badgeClass}">${o.status}</span></div>
    <div class="modal-actions">
      ${o.status==='waiting'?`
        <button class="btn btn-success btn-sm" onclick="setOrderStatus('${o.id}','pending');closeOrderModal()">✓ Accept</button>
        <button class="btn btn-danger btn-sm" onclick="setOrderStatus('${o.id}','cancelled');closeOrderModal()">✗ Cancel</button>`:''}
      ${o.status==='pending'?`
        <button class="btn btn-success btn-sm" onclick="setOrderStatus('${o.id}','done');closeOrderModal()">✓ Mark Done</button>
        <button class="btn btn-danger btn-sm" onclick="setOrderStatus('${o.id}','cancelled');closeOrderModal()">✗ Cancel</button>`:''}
      <button class="btn btn-ghost btn-sm" onclick="closeOrderModal()">Close</button>
    </div>`;
  document.getElementById('order-detail-modal').style.display='';
}
function closeOrderModal(){document.getElementById('order-detail-modal').style.display='none'}

// ═══════════════════════════════════════════════════════════
//  ANALYTICS
// ═══════════════════════════════════════════════════════════
function analyticsPage() {
  const pc = document.getElementById('page-content');
  const doneOrders = state.orders.filter(o=>o.status==='done');
  const now = new Date();

  function revenueFor(orders) { return orders.reduce((a,o)=>a+orderTotal(o),0); }

  const todayStr = now.toDateString();
  const todayO = doneOrders.filter(o=>new Date(o.createdAt).toDateString()===todayStr);

  const weekStart = new Date(now); weekStart.setDate(now.getDate()-now.getDay()+1); weekStart.setHours(0,0,0,0);
  const weekO = doneOrders.filter(o=>new Date(o.createdAt)>=weekStart);

  const monthStart = new Date(now.getFullYear(),now.getMonth(),1);
  const monthO = doneOrders.filter(o=>new Date(o.createdAt)>=monthStart);

  const days7=[];
  for(let i=6;i>=0;i--){
    const d=new Date(now); d.setDate(now.getDate()-i);
    const ds=d.toDateString();
    const rev=revenueFor(doneOrders.filter(o=>new Date(o.createdAt).toDateString()===ds));
    const label=d.toLocaleDateString(undefined,{weekday:'short',day:'numeric'});
    days7.push({label,rev});
  }
  const maxRev7=Math.max(...days7.map(x=>x.rev),1);

  const weeks4=[];
  for(let i=3;i>=0;i--){
    const wstart=new Date(now); wstart.setDate(now.getDate()-i*7-6); wstart.setHours(0,0,0,0);
    const wend=new Date(now); wend.setDate(now.getDate()-i*7+1); wend.setHours(23,59,59,999);
    const rev=revenueFor(doneOrders.filter(o=>{const d=new Date(o.createdAt);return d>=wstart&&d<=wend;}));
    weeks4.push({label:`W-${i>0?i:'now'}`,rev});
  }
  const maxRev4=Math.max(...weeks4.map(x=>x.rev),1);

  const itemRev={};
  doneOrders.forEach(o=>o.items.forEach(oi=>{itemRev[oi.itemId]=(itemRev[oi.itemId]||0)+oi.price*oi.qty}));
  const topByRev=Object.entries(itemRev).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([id,rev])=>({item:state.items.find(i=>i.id===id),rev})).filter(x=>x.item);
  const maxItemRev=Math.max(...topByRev.map(x=>x.rev),1);

  const dmRev={};
  doneOrders.forEach(o=>{dmRev[o.deliveryManId]=(dmRev[o.deliveryManId]||0)+orderTotal(o)});
  const maxDmRev=Math.max(...Object.values(dmRev),1);

  // Feature 7: include waiting in status breakdown
  const allStatuses=['waiting','pending','done','cancelled'];

  pc.innerHTML=`
  <div class="section-title">📈 Analytics Dashboard</div>
  <div class="grid-4" style="margin-bottom:20px">
    <div class="stat-card"><div class="stat-label">Today</div><div class="stat-value">${fmt(revenueFor(todayO))} <span style="font-size:14px;font-weight:500">$ USD</span></div><div class="stat-sub">${todayO.length} orders</div></div>
    <div class="stat-card"><div class="stat-label">This Week</div><div class="stat-value">${fmt(revenueFor(weekO))} <span style="font-size:14px;font-weight:500">$ USD</span></div><div class="stat-sub">${weekO.length} orders</div></div>
    <div class="stat-card"><div class="stat-label">This Month</div><div class="stat-value">${fmt(revenueFor(monthO))} <span style="font-size:14px;font-weight:500">$ USD</span></div><div class="stat-sub">${monthO.length} orders</div></div>
    <div class="stat-card"><div class="stat-label">All Time</div><div class="stat-value">${fmt(revenueFor(doneOrders))} <span style="font-size:14px;font-weight:500">$ USD</span></div><div class="stat-sub">${doneOrders.length} orders total</div></div>
  </div>
  <div class="grid-2" style="margin-bottom:20px">
    <div class="card">
      <div class="card-title">Revenue — Last 7 Days</div>
      <div class="chart-bar-wrap">
        ${days7.map(d=>`<div class="chart-bar-row">
          <div class="chart-bar-label">${d.label}</div>
          <div class="chart-bar-track"><div class="chart-bar-fill" style="width:${d.rev?Math.round(d.rev/maxRev7*100):0}%"></div></div>
          <div class="chart-bar-val">${fmt(d.rev)}</div>
        </div>`).join('')}
      </div>
    </div>
    <div class="card">
      <div class="card-title">Revenue — Last 4 Weeks</div>
      <div class="chart-bar-wrap">
        ${weeks4.map(w=>`<div class="chart-bar-row">
          <div class="chart-bar-label">${w.label}</div>
          <div class="chart-bar-track"><div class="chart-bar-fill" style="width:${w.rev?Math.round(w.rev/maxRev4*100):0}%"></div></div>
          <div class="chart-bar-val">${fmt(w.rev)}</div>
        </div>`).join('')}
      </div>
    </div>
  </div>
  <div class="grid-2" style="margin-bottom:20px">
    <div class="card">
      <div class="card-title">🏆 Revenue by Item</div>
      <div class="chart-bar-wrap">
        ${topByRev.length ? topByRev.map(x=>`<div class="chart-bar-row">
          <div class="chart-bar-label">${esc(x.item.name)}</div>
          <div class="chart-bar-track"><div class="chart-bar-fill" style="width:${Math.round(x.rev/maxItemRev*100)}%;background:#7c3aed"></div></div>
          <div class="chart-bar-val">${fmt(x.rev)}</div>
        </div>`).join('') : '<div class="empty-state" style="padding:16px 0">No data</div>'}
      </div>
    </div>
    <div class="card">
      <div class="card-title">🚚 Revenue by Delivery Man</div>
      <div class="chart-bar-wrap">
        ${state.deliveryMen.length ? state.deliveryMen.map(dm=>{
          const rev=dmRev[dm.id]||0;
          const cnt=doneOrders.filter(o=>o.deliveryManId===dm.id).length;
          return `<div class="chart-bar-row">
            <div class="chart-bar-label">${esc(dm.name.split(' ')[0])}</div>
            <div class="chart-bar-track"><div class="chart-bar-fill" style="width:${maxDmRev?Math.round(rev/maxDmRev*100):0}%;background:var(--green)"></div></div>
            <div class="chart-bar-val">${fmt(rev)}</div>
          </div>`;
        }).join('') : '<div class="empty-state" style="padding:16px 0">No data</div>'}
      </div>
    </div>
  </div>
  <div class="card">
    <div class="card-title">📦 Order Status Breakdown</div>
    <div class="grid-4">
      ${allStatuses.map(s=>{
        const cnt=state.orders.filter(o=>o.status===s).length;
        const total=state.orders.length||1;
        const pct=Math.round(cnt/total*100);
        const col=s==='done'?'var(--green)':s==='cancelled'?'var(--red)':s==='waiting'?'var(--accent)':'var(--orange)';
        return `<div style="text-align:center;padding:12px">
          <div style="font-size:32px;font-weight:800;color:${col}">${cnt}</div>
          <div style="font-size:13px;color:var(--text-muted);margin-top:4px;text-transform:capitalize">${s}</div>
          <div style="font-size:11px;color:var(--text-hint)">${pct}% of all orders</div>
        </div>`;
      }).join('')}
    </div>
  </div>`;
}

// ═══════════════════════════════════════════════════════════
//  ITEMS MANAGEMENT
//  Feature 4: Category as managed list
// ═══════════════════════════════════════════════════════════
function itemsPage() {
  const pc = document.getElementById('page-content');
  pc.innerHTML = `
  <div class="section-title">🛒 Items Management</div>
  <div class="grid-2" style="align-items:start;margin-bottom:20px">
    <div class="card">
      <div class="card-title">Add / Edit Item</div>
      <div style="display:flex;flex-direction:column;gap:10px">
        <input type="hidden" id="item-edit-id">
        <div class="field"><label>Item Name</label><input class="inp" id="item-name" placeholder="e.g. Burger"></div>
        <div class="field"><label>Price ($ USD)</label><input class="inp" id="item-price" type="number" min="0" step="0.5" placeholder="0.00"></div>
        <div class="field">
          <label>Category</label>
          <select class="inp" id="item-cat">
            <option value="">— Select category —</option>
            ${state.categories.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('')}
          </select>
        </div>
        <div class="flex-row" style="margin-top:4px">
          <button class="btn btn-primary" onclick="saveItem()" style="flex:1">Save Item</button>
          <button class="btn btn-ghost btn-sm" onclick="clearItemForm()">Clear</button>
        </div>
      </div>
    </div>
    <div class="card">
      <div class="card-title">All Items (${state.items.length})</div>
      <input class="search-box" id="item-search" type="text" placeholder="Search..." oninput="renderItemsTable()" style="width:100%;margin-bottom:12px">
      <div id="items-table"></div>
    </div>
  </div>

  <!-- Category Management -->
  <div class="card">
    <div class="card-title">🏷 Manage Categories</div>
    <div style="display:flex;gap:10px;margin-bottom:16px;align-items:flex-end">
      <div class="field" style="flex:1;margin:0">
        <label>New Category Name</label>
        <input class="inp" id="new-cat-name" placeholder="e.g. Desserts" onkeydown="if(event.key==='Enter')addCategory()">
      </div>
      <button class="btn btn-primary" onclick="addCategory()">+ Add Category</button>
    </div>
    <div id="cat-list" class="category-chips"></div>
  </div>`;

  renderItemsTable();
  renderCategoryList();
}

function renderCategoryList() {
  const el = document.getElementById('cat-list'); if(!el) return;
  if (!state.categories.length) { el.innerHTML='<div style="color:var(--text-hint);font-size:13px">No categories yet.</div>'; return; }
  el.innerHTML = state.categories.map(cat => {
    const itemCount = state.items.filter(i=>i.category===cat).length;
    return `<div class="category-chip">
      <span class="cat-chip-name">${esc(cat)}</span>
      <span class="cat-chip-count">${itemCount} item${itemCount!==1?'s':''}</span>
      <button class="btn btn-ghost btn-xs cat-chip-edit" onclick="renameCategoryPrompt('${esc(cat)}')">Edit</button>
      <button class="btn btn-danger btn-xs" onclick="deleteCategory('${esc(cat)}')">×</button>
    </div>`;
  }).join('');
}

function addCategory() {
  const input = document.getElementById('new-cat-name');
  const name = input?.value.trim();
  if (!name) { input?.focus(); return; }
  if (state.categories.includes(name)) { alert('Category already exists.'); return; }
  const snap = JSON.stringify(state);
  state.categories.push(name);
  addHist('add', `Added category: ${name}`, snap);
  persist();
  input.value = '';
  renderCategoryList();
  // Refresh item form dropdown
  const sel = document.getElementById('item-cat');
  if (sel) sel.innerHTML = '<option value="">— Select category —</option>' + state.categories.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('');
}

function renameCategoryPrompt(oldName) {
  const newName = prompt(`Rename category "${oldName}" to:`, oldName);
  if (!newName || newName.trim() === oldName) return;
  const trimmed = newName.trim();
  if (state.categories.includes(trimmed)) { alert('Category already exists.'); return; }
  const snap = JSON.stringify(state);
  const idx = state.categories.indexOf(oldName);
  if (idx !== -1) state.categories[idx] = trimmed;
  state.items.forEach(it => { if (it.category === oldName) it.category = trimmed; });
  addHist('edit', `Renamed category: ${oldName} → ${trimmed}`, snap);
  persist();
  renderCategoryList();
  const sel = document.getElementById('item-cat');
  if (sel) sel.innerHTML = '<option value="">— Select category —</option>' + state.categories.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('');
}

function deleteCategory(name) {
  const count = state.items.filter(i=>i.category===name).length;
  const msg = count > 0
    ? `Delete category "${name}"? ${count} item(s) will become uncategorized.`
    : `Delete category "${name}"?`;
  showConfirm('Delete Category', msg, () => {
    const snap = JSON.stringify(state);
    state.categories = state.categories.filter(c=>c!==name);
    state.items.forEach(it => { if (it.category === name) it.category = 'Uncategorized'; });
    addHist('del', `Deleted category: ${name}`, snap);
    persist();
    renderCategoryList();
    renderItemsTable();
    const sel = document.getElementById('item-cat');
    if (sel) sel.innerHTML = '<option value="">— Select category —</option>' + state.categories.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('');
  });
}

function renderItemsTable() {
  const q=(document.getElementById('item-search')?.value||'').toLowerCase();
  const filtered=state.items.filter(i=>i.name.toLowerCase().includes(q)||(i.category||'').toLowerCase().includes(q));
  const el=document.getElementById('items-table'); if(!el)return;
  if(!filtered.length){el.innerHTML='<div class="empty-state" style="padding:20px 0"><div class="empty-icon">🛒</div>No items yet.</div>';return;}
  el.innerHTML=`<div class="table-wrap"><table>
    <thead><tr><th>Name</th><th>Price</th><th>Category</th><th></th></tr></thead>
    <tbody>${filtered.map(it=>`<tr>
      <td style="font-weight:500">${esc(it.name)}</td>
      <td style="font-weight:700;color:var(--accent)">${fmt(it.price)} $ USD</td>
      <td><span class="tag">${esc(it.category||'—')}</span></td>
      <td><div class="action-group">
        <button class="btn btn-ghost btn-xs" onclick="editItem('${it.id}')">Edit</button>
        <button class="btn btn-danger btn-xs" onclick="deleteItem('${it.id}')">×</button>
      </div></td>
    </tr>`).join('')}</tbody>
  </table></div>`;
}

function saveItem() {
  const name=document.getElementById('item-name')?.value.trim();
  const price=parseFloat(document.getElementById('item-price')?.value);
  const cat=document.getElementById('item-cat')?.value.trim();
  const editId=document.getElementById('item-edit-id')?.value;
  if(!name){alert('Name required');return;}
  if(isNaN(price)||price<0){alert('Valid price required');return;}
  const snap=JSON.stringify(state);
  if(editId){
    const it=state.items.find(i=>i.id===editId);
    if(it){it.name=name;it.price=price;it.category=cat;}
    addHist('edit',`Updated item: ${name}`,snap);
  } else {
    state.items.push({id:uid(),name,price,category:cat});
    addHist('add',`Added item: ${name} @ ${fmt(price)} $ USD`,snap);
  }
  persist(); clearItemForm(); renderItemsTable();
}

function editItem(id) {
  const it=state.items.find(i=>i.id===id); if(!it)return;
  document.getElementById('item-edit-id').value=it.id;
  document.getElementById('item-name').value=it.name;
  document.getElementById('item-price').value=it.price;
  const sel = document.getElementById('item-cat');
  if (sel) sel.value = it.category||'';
  document.getElementById('item-name').focus();
}

function deleteItem(id) {
  const it=state.items.find(i=>i.id===id); if(!it)return;
  const doIt=()=>{
    const snap=JSON.stringify(state);
    state.items=state.items.filter(i=>i.id!==id);
    addHist('del',`Deleted item: ${it.name}`,snap);
    persist(); renderItemsTable();
  };
  if(state.settings.confirmdelete) showConfirm('Delete item',`Delete "${it.name}"?`,doIt);
  else doIt();
}

function clearItemForm() {
  document.getElementById('item-edit-id').value='';
  document.getElementById('item-name').value='';
  document.getElementById('item-price').value='';
  const sel=document.getElementById('item-cat'); if(sel) sel.value='';
}

// ═══════════════════════════════════════════════════════════
//  DELIVERY MEN — Feature 5: Phone field removed
// ═══════════════════════════════════════════════════════════
function deliveryPage() {
  const pc=document.getElementById('page-content');
  pc.innerHTML=`
  <div class="section-title">🚚 Delivery Men</div>
  <div class="grid-2" style="align-items:start">
    <div class="card">
      <div class="card-title">Add / Edit Delivery Man</div>
      <div style="display:flex;flex-direction:column;gap:10px">
        <input type="hidden" id="dm-edit-id">
        <div class="field"><label>Full Name</label><input class="inp" id="dm-name" placeholder="e.g. Ahmed Hassan"></div>
        <div class="flex-row" style="margin-top:4px">
          <button class="btn btn-primary" onclick="saveDM()" style="flex:1">Save</button>
          <button class="btn btn-ghost btn-sm" onclick="clearDMForm()">Clear</button>
        </div>
      </div>
    </div>
    <div class="card">
      <div class="card-title">All Delivery Men (${state.deliveryMen.length})</div>
      <div id="dm-table"></div>
    </div>
  </div>`;
  renderDMTable();
}

function renderDMTable() {
  const el=document.getElementById('dm-table'); if(!el)return;
  if(!state.deliveryMen.length){el.innerHTML='<div class="empty-state" style="padding:20px 0"><div class="empty-icon">🚚</div>No delivery men yet.</div>';return;}
  el.innerHTML=`<div class="table-wrap"><table>
    <thead><tr><th>Name</th><th>Orders</th><th>Revenue</th><th></th></tr></thead>
    <tbody>${state.deliveryMen.map(dm=>{
      const doneOrd=state.orders.filter(o=>o.deliveryManId===dm.id&&o.status==='done');
      const rev=doneOrd.reduce((a,o)=>a+orderTotal(o),0);
      return `<tr>
        <td style="font-weight:500">${esc(dm.name)}</td>
        <td><span class="badge badge-info">${doneOrd.length}</span></td>
        <td style="font-weight:700;color:var(--green)">${fmt(rev)} $ USD</td>
        <td><div class="action-group">
          <button class="btn btn-ghost btn-xs" onclick="editDM('${dm.id}')">Edit</button>
          <button class="btn btn-danger btn-xs" onclick="deleteDM('${dm.id}')">×</button>
        </div></td>
      </tr>`;
    }).join('')}</tbody>
  </table></div>`;
}

function saveDM() {
  const name=document.getElementById('dm-name')?.value.trim();
  const editId=document.getElementById('dm-edit-id')?.value;
  if(!name){alert('Name required');return;}
  const snap=JSON.stringify(state);
  if(editId){
    const dm=state.deliveryMen.find(d=>d.id===editId);
    if(dm){dm.name=name;}
    addHist('edit',`Updated delivery man: ${name}`,snap);
  } else {
    state.deliveryMen.push({id:uid(),name});
    addHist('add',`Added delivery man: ${name}`,snap);
  }
  persist(); clearDMForm(); renderDMTable();
}

function editDM(id){
  const dm=state.deliveryMen.find(d=>d.id===id); if(!dm)return;
  document.getElementById('dm-edit-id').value=dm.id;
  document.getElementById('dm-name').value=dm.name;
  document.getElementById('dm-name').focus();
}

function deleteDM(id){
  const dm=state.deliveryMen.find(d=>d.id===id); if(!dm)return;
  const doIt=()=>{
    const snap=JSON.stringify(state);
    state.deliveryMen=state.deliveryMen.filter(d=>d.id!==id);
    addHist('del',`Deleted delivery man: ${dm.name}`,snap);
    persist(); renderDMTable();
  };
  if(state.settings.confirmdelete) showConfirm('Delete',`Delete "${dm.name}"?`,doIt);
  else doIt();
}
function clearDMForm(){document.getElementById('dm-edit-id').value='';document.getElementById('dm-name').value='';}

// ═══════════════════════════════════════════════════════════
//  CREDENTIALS (preserved)
// ═══════════════════════════════════════════════════════════
function credentialsPage() {
  const pc=document.getElementById('page-content');
  pc.innerHTML=`
  <div class="section-title">🔒 Credentials</div>
  <div class="card" style="margin-bottom:16px">
    <div class="card-title">Add Credential</div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr auto;gap:10px;align-items:end">
      <div class="field"><label>Name</label><input class="inp" id="inp-name" type="text" placeholder="e.g. John Doe"></div>
      <div class="field"><label>Email</label><input class="inp" id="inp-email" type="email" placeholder="john@example.com"></div>
      <div class="field"><label>Password</label><input class="inp" id="inp-pass" type="text" placeholder="password123"></div>
      <button class="btn btn-primary" onclick="addCredential()" style="align-self:end">+ Add</button>
    </div>
  </div>
  <div class="card">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;flex-wrap:wrap;gap:8px">
      <div class="card-title" style="margin:0">Stored Credentials</div>
      <div class="flex-row">
        <input class="search-box" id="search-inp" type="text" placeholder="Search..." oninput="renderCredTable()" style="min-width:160px">
        <button class="btn btn-ghost btn-sm" onclick="showPdfModal()">⬇ PDF</button>
      </div>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th style="width:28px"></th><th style="width:28px"><input type="checkbox" id="check-all" onchange="toggleAll(this)"></th><th>Name</th><th>Email</th><th>Password</th><th>Stocks</th><th>Added</th><th>Actions</th></tr></thead>
        <tbody id="cred-tbody"></tbody>
      </table>
      <div id="empty-state" class="empty-state" style="display:none"><div class="empty-icon">🔒</div>No credentials yet.</div>
    </div>
  </div>
  <!-- PDF Modal -->
  <div id="pdf-modal" class="modal-bg" style="display:none">
    <div class="modal">
      <h3>Export PDF</h3><p>Choose which credentials to export.</p>
      <div style="display:flex;flex-direction:column;gap:12px">
        <div class="pdf-row">
          <label style="font-size:13px;display:flex;align-items:center;gap:6px;cursor:pointer"><input type="radio" name="pdf-scope" value="all" checked> All</label>
          <label style="font-size:13px;display:flex;align-items:center;gap:6px;cursor:pointer"><input type="radio" name="pdf-scope" value="selected"> Selected</label>
        </div>
        <select class="inp" id="pdf-email-select" style="height:34px"><option value="">— or pick specific —</option></select>
      </div>
      <div class="modal-actions">
        <button class="btn btn-ghost btn-sm" onclick="closePdfModal()">Cancel</button>
        <button class="btn btn-primary btn-sm" onclick="exportPDF()">Export PDF</button>
      </div>
    </div>
  </div>`;
  renderCredTable();
}

function addCredential(){
  const name=document.getElementById('inp-name')?.value.trim();
  const email=document.getElementById('inp-email')?.value.trim();
  const pass=document.getElementById('inp-pass')?.value.trim();
  if(!name||!email||!pass){alert('All fields required');return;}
  const snap=JSON.stringify(state);
  state.credentials.unshift({id:uid(),name,email,pass,stocks:[],added:new Date().toISOString()});
  addHist('add',`Added credential: ${name} (${email})`,snap);
  persist(); renderCredTable();
  document.getElementById('inp-name').value='';
  document.getElementById('inp-email').value='';
  document.getElementById('inp-pass').value='';
}

const copyIcon=`<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M16 1H4C2.9 1 2 1.9 2 3v14h2V3h12V1zm3 4H8C6.9 5 6 5.9 6 7v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>`;

function renderCredTable(){
  const q=(document.getElementById('search-inp')?.value||'').toLowerCase();
  const filtered=state.credentials.filter(c=>c.name.toLowerCase().includes(q)||c.email.toLowerCase().includes(q)).slice(0,state.settings.rowsperpage);
  const tbody=document.getElementById('cred-tbody');
  const empty=document.getElementById('empty-state');
  if(!filtered.length){if(tbody)tbody.innerHTML='';if(empty)empty.style.display='';return;}
  if(empty)empty.style.display='none';
  let html='';
  filtered.forEach(c=>{
    const isEd=editingId===c.id;
    const isExp=expandedIds.has(c.id);
    const dateStr=fmtDate(c.added);
    const passDisp=state.settings.showpass?esc(c.pass):'••••••••';
    const passCls=state.settings.showpass?'':'pass-mask';
    const sc=(c.stocks||[]).length;
    if(isEd){
      html+=`<tr><td></td><td><input type="checkbox" class="row-check" data-id="${c.id}"></td>
        <td><input class="inline-edit" id="edit-name-${c.id}" value="${esc(c.name)}"></td>
        <td><input class="inline-edit" id="edit-email-${c.id}" value="${esc(c.email)}"></td>
        <td><input class="inline-edit" id="edit-pass-${c.id}" value="${esc(c.pass)}"></td>
        <td><span class="tag">${sc}</span></td><td><span class="tag">${dateStr}</span></td>
        <td><div class="action-group">
          <button class="btn btn-primary btn-sm" onclick="saveCredEdit('${c.id}')">Save</button>
          <button class="btn btn-ghost btn-sm" onclick="cancelCredEdit()">Cancel</button>
        </div></td></tr>`;
    } else {
      html+=`<tr><td><button class="expand-btn${isExp?' open':''}" onclick="toggleCredExpand('${c.id}')">${isExp?'▾':'▸'}</button></td>
        <td><input type="checkbox" class="row-check" data-id="${c.id}"></td>
        <td style="font-weight:500">${esc(c.name)}</td>
        <td><div style="display:flex;align-items:center;gap:6px">${esc(c.email)}<button class="copy-btn" onclick="copyText('${esc(c.email)}',this)">${copyIcon}</button></div></td>
        <td><div style="display:flex;align-items:center;gap:6px"><span class="${passCls}">${passDisp}</span><button class="copy-btn" onclick="copyText('${esc(c.pass)}',this)">${copyIcon}</button></div></td>
        <td>${sc>0?`<span class="stock-badge">📈 ${sc}</span>`:'<span style="color:var(--text-hint);font-size:11px">—</span>'}</td>
        <td><span class="tag">${dateStr}</span></td>
        <td><div class="action-group">
          <button class="btn btn-ghost btn-sm" onclick="startCredEdit('${c.id}')">Edit</button>
          <button class="btn btn-danger btn-sm" onclick="deleteCred('${c.id}')">Delete</button>
        </div></td></tr>`;
    }
    if(isExp){
      html+=`<tr style="background:var(--stock-bg)"><td colspan="8" style="padding:0"><div class="stock-panel">
        <div class="stock-panel-header"><span class="stock-panel-title">📈 Stocks for ${esc(c.email)}</span></div>
        <div class="stock-list">`;
      if(!(c.stocks||[]).length){ html+=`<div class="stock-empty">No stocks added.</div>`; }
      else {
        c.stocks.forEach(s=>{
          const isES=editingStockId&&editingStockId.credId===c.id&&editingStockId.stockId===s.id;
          if(isES){
            html+=`<div class="stock-item"><input class="stock-inp stock-inp-name" id="sedit-name-${s.id}" value="${esc(s.name)}"><input class="stock-inp stock-inp-qty" id="sedit-qty-${s.id}" type="number" min="0" step="any" value="${s.qty}"><div class="stock-spacer"></div><button class="btn btn-primary btn-xs" onclick="saveStockEdit('${c.id}','${s.id}')">Save</button><button class="btn btn-ghost btn-xs" onclick="cancelStockEdit()">Cancel</button></div>`;
          } else {
            html+=`<div class="stock-item"><span class="stock-name">${esc(s.name)}</span><span class="stock-qty">× ${s.qty}</span><div class="stock-spacer"></div><button class="btn btn-ghost btn-xs" onclick="startStockEdit('${c.id}','${s.id}')">Edit</button><button class="btn btn-danger btn-xs" onclick="deleteStock('${c.id}','${s.id}')">×</button></div>`;
          }
        });
      }
      html+=`</div><div class="stock-add-form">
        <input class="stock-inp stock-inp-name" id="sinp-name-${c.id}" type="text" placeholder="Ticker" onkeydown="if(event.key==='Enter')addStock('${c.id}')">
        <input class="stock-inp stock-inp-qty" id="sinp-qty-${c.id}" type="number" min="0" step="any" placeholder="Qty" onkeydown="if(event.key==='Enter')addStock('${c.id}')">
        <button class="btn btn-primary btn-xs" onclick="addStock('${c.id}')">+ Add Stock</button>
      </div></div></td></tr>`;
    }
  });
  if(tbody) tbody.innerHTML=html;
}

function copyText(text,btn){
  navigator.clipboard.writeText(text).then(()=>{
    btn.classList.add('copied');
    btn.innerHTML=`<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>`;
    setTimeout(()=>{btn.classList.remove('copied');btn.innerHTML=copyIcon;},1500);
  }).catch(()=>alert('Copy failed.'));
}
function startCredEdit(id){editingId=id;renderCredTable();}
function cancelCredEdit(){editingId=null;renderCredTable();}
function saveCredEdit(id){
  const c=state.credentials.find(x=>x.id===id);if(!c)return;
  const snap=JSON.stringify(state);
  const name=document.getElementById('edit-name-'+id)?.value.trim();
  const email=document.getElementById('edit-email-'+id)?.value.trim();
  const pass=document.getElementById('edit-pass-'+id)?.value.trim();
  if(!name||!email||!pass){alert('All required');return;}
  c.name=name;c.email=email;c.pass=pass;editingId=null;
  addHist('edit',`Edited credential: ${name}`,snap);persist();renderCredTable();
}
function deleteCred(id){
  const c=state.credentials.find(x=>x.id===id);if(!c)return;
  const doIt=()=>{const snap=JSON.stringify(state);state.credentials=state.credentials.filter(x=>x.id!==id);expandedIds.delete(id);addHist('del',`Deleted credential: ${c.name}`,snap);persist();renderCredTable();};
  if(state.settings.confirmdelete) showConfirm('Delete credential',`Delete "${c.name}"?`,doIt);else doIt();
}
function toggleAll(cb){document.querySelectorAll('.row-check').forEach(c=>c.checked=cb.checked);}
function toggleCredExpand(id){if(expandedIds.has(id))expandedIds.delete(id);else expandedIds.add(id);renderCredTable();}
function startStockEdit(cid,sid){editingStockId={credId:cid,stockId:sid};renderCredTable();}
function cancelStockEdit(){editingStockId=null;renderCredTable();}
function saveStockEdit(cid,sid){
  const c=state.credentials.find(x=>x.id===cid);const s=c&&c.stocks.find(x=>x.id===sid);if(!c||!s)return;
  const snap=JSON.stringify(state);
  const name=document.getElementById('sedit-name-'+sid)?.value.trim().toUpperCase();
  const qty=parseFloat(document.getElementById('sedit-qty-'+sid)?.value);
  if(!name||isNaN(qty)){alert('Valid name and quantity required');return;}
  s.name=name;s.qty=qty;editingStockId=null;
  addHist('edit',`Edited stock ${name} for ${c.email}`,snap);persist();renderCredTable();
}
function addStock(cid){
  const c=state.credentials.find(x=>x.id===cid);if(!c)return;
  const nameEl=document.getElementById('sinp-name-'+cid);
  const qtyEl=document.getElementById('sinp-qty-'+cid);
  const name=nameEl?.value.trim().toUpperCase();
  const qty=parseFloat(qtyEl?.value);
  if(!name){nameEl?.focus();return;}if(isNaN(qty)||qty<0){qtyEl?.focus();return;}
  const snap=JSON.stringify(state);
  c.stocks.push({id:uid(),name,qty});
  addHist('edit',`Added stock ${name} ×${qty} to ${c.email}`,snap);persist();renderCredTable();
}
function deleteStock(cid,sid){
  const c=state.credentials.find(x=>x.id===cid);const s=c&&c.stocks.find(x=>x.id===sid);if(!c||!s)return;
  const snap=JSON.stringify(state);
  c.stocks=c.stocks.filter(x=>x.id!==sid);
  addHist('del',`Removed stock ${s.name} from ${c.email}`,snap);persist();renderCredTable();
}
function showPdfModal(){
  const sel=document.getElementById('pdf-email-select');
  if(sel){sel.innerHTML='<option value="">— or pick specific —</option>'+state.credentials.map(c=>`<option value="${c.id}">${esc(c.email)} — ${esc(c.name)}</option>`).join('');}
  document.getElementById('pdf-modal').style.display='';
}
function closePdfModal(){document.getElementById('pdf-modal').style.display='none';}
function exportPDF(){
  const scope=document.querySelector('input[name="pdf-scope"]:checked')?.value;
  const specificId=document.getElementById('pdf-email-select')?.value;
  let toExport=state.credentials;
  if(specificId) toExport=state.credentials.filter(c=>c.id===specificId);
  else if(scope==='selected'){const checked=[...document.querySelectorAll('.row-check:checked')].map(c=>c.dataset.id);if(checked.length)toExport=state.credentials.filter(c=>checked.includes(c.id));}
  if(!toExport.length){alert('Nothing to export');return;}
  const {jsPDF}=window.jspdf;const doc=new jsPDF({unit:'mm',format:'a4'});
  const pw=210,mx=18,cw=pw-mx*2;let y=18;
  doc.setFillColor(24,95,165);doc.roundedRect(mx,y,cw,16,3,3,'F');
  doc.setFontSize(14);doc.setFont('helvetica','bold');doc.setTextColor(255,255,255);
  doc.text('Vault — Credential Export',mx+8,y+10.5);
  doc.setFontSize(9);doc.setFont('helvetica','normal');
  doc.text(new Date().toLocaleDateString(undefined,{year:'numeric',month:'long',day:'numeric'}),pw-mx-4,y+10.5,{align:'right'});
  y+=24;
  toExport.forEach((c,i)=>{
    const stocks=c.stocks||[];const cardH=38+(stocks.length>0?6+stocks.length*8:0);
    if(y+cardH>272){doc.addPage();y=18;}
    doc.setFillColor(248,249,252);doc.roundedRect(mx,y,cw,cardH,3,3,'F');
    doc.setDrawColor(220,225,235);doc.setLineWidth(0.3);doc.roundedRect(mx,y,cw,cardH,3,3,'S');
    doc.setFillColor(24,95,165);doc.circle(mx+8,y+8,5,'F');
    doc.setFontSize(8);doc.setFont('helvetica','bold');doc.setTextColor(255,255,255);doc.text(String(i+1),mx+8,y+10.2,{align:'center'});
    doc.setFontSize(12);doc.setFont('helvetica','bold');doc.setTextColor(17,17,17);doc.text(c.name,mx+17,y+10);
    doc.setDrawColor(220,225,235);doc.setLineWidth(0.2);doc.line(mx+8,y+14,mx+cw-8,y+14);
    doc.setFontSize(9);doc.setFont('helvetica','normal');doc.setTextColor(130,140,160);doc.text('Email',mx+8,y+23);doc.text('Password',mx+8,y+32);
    doc.setTextColor(24,95,165);doc.setFontSize(10);doc.text(c.email,mx+36,y+23);doc.setTextColor(17,17,17);doc.text(c.pass,mx+36,y+32);
    if(stocks.length){let sy=y+38;doc.setDrawColor(190,210,240);doc.setLineWidth(0.2);doc.line(mx+8,sy,mx+cw-8,sy);sy+=5;
      doc.setFontSize(8);doc.setFont('helvetica','bold');doc.setTextColor(24,95,165);doc.text('STOCKS',mx+8,sy);
      doc.setTextColor(130,140,160);doc.text('Ticker',mx+30,sy);doc.text('Qty',mx+80,sy);sy+=5;
      stocks.forEach(s=>{doc.setFont('helvetica','bold');doc.setTextColor(17,17,17);doc.setFontSize(9);doc.text(s.name,mx+30,sy);doc.setFont('helvetica','normal');doc.setTextColor(60,60,80);doc.text(String(s.qty),mx+80,sy);sy+=8;});
    }
    y+=cardH+6;
  });
  if(y<277){doc.setDrawColor(210,215,225);doc.setLineWidth(0.2);doc.line(mx,y+4,mx+cw,y+4);doc.setFontSize(8);doc.setFont('helvetica','normal');doc.setTextColor(160,165,175);doc.text(`${toExport.length} credential(s) exported · Vault`,mx,y+10);}
  doc.save('vault-credentials.pdf');closePdfModal();
}

// ═══════════════════════════════════════════════════════════
//  HISTORY
// ═══════════════════════════════════════════════════════════
function historyPage(){
  const pc=document.getElementById('page-content');
  pc.innerHTML=`<div class="section-title">🕐 Change History</div>
  <div class="card">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:8px">
      <div class="card-title" style="margin:0">${state.history.length} entries</div>
      <button class="btn btn-danger btn-sm" onclick="clearHistory()">Clear all</button>
    </div>
    <div id="history-list"></div>
  </div>`;
  renderHistoryList();
}
function renderHistoryList(){
  const el=document.getElementById('history-list');if(!el)return;
  if(!state.history.length){el.innerHTML='<div class="empty-state"><div class="empty-icon">📋</div>No history yet.</div>';return;}
  el.innerHTML=state.history.map(h=>{
    const dot=h.type==='add'?'h-add':h.type==='edit'?'h-edit':'h-del';
    const timeStr=new Date(h.time).toLocaleString(undefined,{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});
    const canRestore=(h.type==='edit'||h.type==='del')&&h.snapshot;
    return `<div class="history-item">
      <div class="history-dot ${dot}"></div>
      <div class="history-body"><div class="history-msg">${esc(h.msg)}</div><div class="history-time">${timeStr}</div></div>
      <div style="display:flex;gap:4px">
        ${canRestore?`<button class="btn btn-ghost btn-sm" onclick="restoreSnap('${h.id}')">Restore</button>`:''}
        <button class="btn btn-danger btn-sm" onclick="deleteHist('${h.id}')">×</button>
      </div>
    </div>`;
  }).join('');
}
function restoreSnap(hid){
  const entry=state.history.find(h=>h.id===hid);if(!entry||!entry.snapshot)return;
  showConfirm('Restore','This will overwrite all current data with this snapshot.',()=>{
    try{
      const restored=JSON.parse(entry.snapshot);
      state={...state,...restored};
      state.credentials.forEach(c=>{if(!c.stocks)c.stocks=[];});
      if(!state.categories) state.categories=[];
      addHist('edit',`Restored to snapshot from ${new Date(entry.time).toLocaleString()}`);
      persist();navigate(currentPage);
    }catch(e){alert('Restore failed.');}
  });
}
function deleteHist(hid){state.history=state.history.filter(h=>h.id!==hid);persist();renderHistoryList();}
function clearHistory(){showConfirm('Clear history','Remove all history entries?',()=>{state.history=[];persist();renderHistoryList();});}

// ═══════════════════════════════════════════════════════════
//  SETTINGS
// ═══════════════════════════════════════════════════════════
function settingsPage(){
  const pc=document.getElementById('page-content');
  pc.innerHTML=`<div class="section-title">⚙️ Settings</div>
  <div class="settings-grid">
    <div class="card">
      <div class="card-title">General</div>
      <div class="setting-row"><div><div class="setting-label">Show passwords</div><div class="setting-desc">Reveal by default</div></div>
        <label class="toggle"><input type="checkbox" id="s-showpass" ${state.settings.showpass?'checked':''} onchange="saveSetting()"><span class="toggle-slider"></span></label></div>
      <div class="setting-row"><div><div class="setting-label">Confirm before delete</div><div class="setting-desc">Show dialog before removing</div></div>
        <label class="toggle"><input type="checkbox" id="s-confirmdelete" ${state.settings.confirmdelete?'checked':''} onchange="saveSetting()"><span class="toggle-slider"></span></label></div>
      <div class="setting-row"><div><div class="setting-label">Rows per page</div></div>
        <select class="inp" id="s-rowsperpage" onchange="saveSetting()" style="width:80px">
          <option value="10" ${state.settings.rowsperpage==10?'selected':''}>10</option>
          <option value="25" ${state.settings.rowsperpage==25?'selected':''}>25</option>
          <option value="50" ${state.settings.rowsperpage==50?'selected':''}>50</option>
          <option value="100" ${state.settings.rowsperpage==100?'selected':''}>100</option>
        </select></div>
    </div>
    <div class="card">
      <div class="card-title">History</div>
      <div class="setting-row"><div><div class="setting-label">Auto-delete history after</div></div>
        <select class="inp" id="s-historyretention" onchange="saveSetting();pruneHistory()" style="width:120px">
          <option value="0" ${state.settings.historyretention==0?'selected':''}>Never</option>
          <option value="1" ${state.settings.historyretention==1?'selected':''}>1 day</option>
          <option value="7" ${state.settings.historyretention==7?'selected':''}>7 days</option>
          <option value="30" ${state.settings.historyretention==30?'selected':''}>30 days</option>
          <option value="90" ${state.settings.historyretention==90?'selected':''}>90 days</option>
        </select></div>
      <div class="setting-row"><div><div class="setting-label">Max history entries</div></div>
        <select class="inp" id="s-historylimit" onchange="saveSetting()" style="width:100px">
          <option value="100" ${state.settings.historylimit==100?'selected':''}>100</option>
          <option value="200" ${state.settings.historylimit==200?'selected':''}>200</option>
          <option value="500" ${state.settings.historylimit==500?'selected':''}>500</option>
        </select></div>
    </div>
    <div class="card" style="grid-column:1/-1">
      <div class="card-title">Data Management</div>
      <div class="setting-row"><div><div class="setting-label">Export all data</div><div class="setting-desc">JSON backup of everything</div></div>
        <button class="btn btn-ghost btn-sm" onclick="exportJson()">Export JSON</button></div>
      <div class="setting-row"><div><div class="setting-label">Import from JSON</div><div class="setting-desc">Restore from backup</div></div>
        <label class="btn btn-ghost btn-sm" style="display:inline-flex;align-items:center;cursor:pointer">Import<input type="file" accept=".json" onchange="importJson(event)" style="display:none"></label></div>
      <div class="setting-row"><div><div class="setting-label">Delete ALL data</div><div class="setting-desc">Removes everything permanently</div></div>
        <button class="btn btn-danger btn-sm" onclick="nukeAll()">Delete Everything</button></div>
    </div>
  </div>`;
}
function saveSetting(){
  state.settings.showpass=document.getElementById('s-showpass')?.checked;
  state.settings.confirmdelete=document.getElementById('s-confirmdelete')?.checked;
  state.settings.rowsperpage=parseInt(document.getElementById('s-rowsperpage')?.value)||25;
  state.settings.historyretention=parseInt(document.getElementById('s-historyretention')?.value)||30;
  state.settings.historylimit=parseInt(document.getElementById('s-historylimit')?.value)||200;
  persist();
}
function applySettingsUI(){
  const s=state.settings;
  if(document.getElementById('s-showpass')) document.getElementById('s-showpass').checked=s.showpass;
}
function exportJson(){
  const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='vault-backup.json';a.click();
}
function importJson(e){
  const file=e.target.files[0];if(!file)return;
  const r=new FileReader();
  r.onload=ev=>{
    try{
      const data=JSON.parse(ev.target.result);
      showConfirm('Import data','This will MERGE imported data with current data.',()=>{
        if(data.items) state.items=[...state.items,...data.items.filter(x=>!state.items.find(i=>i.id===x.id))];
        if(data.categories) state.categories=[...new Set([...state.categories,...data.categories])];
        if(data.deliveryMen) state.deliveryMen=[...state.deliveryMen,...data.deliveryMen.filter(x=>!state.deliveryMen.find(i=>i.id===x.id))];
        if(data.orders) state.orders=[...state.orders,...data.orders.filter(x=>!state.orders.find(i=>i.id===x.id))];
        if(data.credentials){state.credentials=[...state.credentials,...data.credentials.filter(x=>!state.credentials.find(i=>i.id===x.id))];state.credentials.forEach(c=>{if(!c.stocks)c.stocks=[];});}
        addHist('add','Imported data from JSON backup');persist();navigate(currentPage);
      });
    }catch(err){alert('Invalid JSON file.');}
  };
  r.readAsText(file);e.target.value='';
}
function nukeAll(){showConfirm('Delete EVERYTHING','This deletes ALL data permanently. Are you absolutely sure?',()=>{state.items=[];state.deliveryMen=[];state.orders=[];state.credentials=[];state.history=[];state.categories=[];persist();navigate('dashboard');});}

// ═══════════════════════════════════════════════════════════
//  ORDERS PDF EXPORT
// ═══════════════════════════════════════════════════════════
function exportOrdersPDF(){
  const filter=document.getElementById('ord-filter')?.value||'all';
  let orders=state.orders;
  if(filter!=='all') orders=orders.filter(o=>o.status===filter);
  if(!orders.length){alert('No orders to export');return;}
  const {jsPDF}=window.jspdf;const doc=new jsPDF({unit:'mm',format:'a4'});
  const pw=210,mx=14,cw=pw-mx*2;let y=16;
  doc.setFillColor(24,95,165);doc.roundedRect(mx,y,cw,14,3,3,'F');
  doc.setFontSize(13);doc.setFont('helvetica','bold');doc.setTextColor(255,255,255);
  doc.text('Vault — Orders Export',mx+6,y+9.5);
  doc.setFontSize(8);doc.setFont('helvetica','normal');
  doc.text(new Date().toLocaleDateString(undefined,{year:'numeric',month:'long',day:'numeric'}),pw-mx-4,y+9.5,{align:'right'});
  y+=20;
  orders.forEach((o,i)=>{
    const dm=state.deliveryMen.find(d=>d.id===o.deliveryManId);
    const total=orderTotal(o);
    const disc=orderDiscountInfo(o);
    const cardH=28+o.items.length*7+(disc.hasDiscount?8:0)+4;
    if(y+cardH>272){doc.addPage();y=16;}
    doc.setFillColor(248,249,252);doc.roundedRect(mx,y,cw,cardH,2,2,'F');
    doc.setDrawColor(220,225,235);doc.setLineWidth(0.25);doc.roundedRect(mx,y,cw,cardH,2,2,'S');
    doc.setFontSize(8);doc.setFont('helvetica','bold');doc.setTextColor(24,95,165);
    doc.text(`#${o.id.slice(-5)}`,mx+4,y+6);
    doc.setTextColor(17,17,17);doc.setFontSize(9);
    doc.text(dm?dm.name:'Unknown',mx+20,y+6);
    if(o.customerId){doc.setTextColor(100,110,130);doc.setFontSize(8);doc.text(`Customer: ${o.customerId}`,mx+70,y+6);}
    const statColor=o.status==='done'?[22,163,74]:o.status==='cancelled'?[220,38,38]:o.status==='waiting'?[24,95,165]:[217,119,6];
    doc.setTextColor(...statColor);
    doc.text(o.status.toUpperCase(),pw-mx-4,y+6,{align:'right'});
    doc.setTextColor(100,110,130);doc.setFontSize(8);
    doc.text(fmtDateTime(o.createdAt),mx+4,y+12);
    doc.setDrawColor(220,225,235);doc.setLineWidth(0.15);doc.line(mx+4,y+15,mx+cw-4,y+15);
    let iy=y+21;
    o.items.forEach(oi=>{
      const it=state.items.find(i=>i.id===oi.itemId);
      doc.setFont('helvetica','normal');doc.setTextColor(40,40,40);doc.setFontSize(8);
      doc.text(`${it?it.name:'?'} × ${oi.qty}`,mx+6,iy);
      doc.setFont('helvetica','bold');doc.setTextColor(24,95,165);
      doc.text(`${fmt(oi.price*oi.qty)} $ USD`,pw-mx-4,iy,{align:'right'});
      iy+=7;
    });
    if(disc.hasDiscount){
      doc.setFont('helvetica','normal');doc.setTextColor(22,163,74);doc.setFontSize(8);
      doc.text(`Discount: -${disc.pct}% (saved ${fmt(disc.saved)} $ USD)`,mx+6,iy);
      iy+=7;
    }
    doc.setDrawColor(190,210,240);doc.setLineWidth(0.15);doc.line(mx+4,iy,mx+cw-4,iy);
    doc.setFont('helvetica','bold');doc.setFontSize(9);doc.setTextColor(17,17,17);
    doc.text('Total',mx+6,iy+5);doc.setTextColor(24,95,165);
    doc.text(`${fmt(total)} $ USD`,pw-mx-4,iy+5,{align:'right'});
    y+=cardH+5;
  });
  doc.save('vault-orders.pdf');
}

// ═══════════════════════════════════════════════════════════
//  CONFIRM MODAL
// ═══════════════════════════════════════════════════════════
function showConfirm(title,msg,cb){
  confirmCb=cb;
  document.getElementById('confirm-title').textContent=title;
  document.getElementById('confirm-msg').textContent=msg;
  document.getElementById('confirm-ok').onclick=()=>{closeConfirm();if(confirmCb)confirmCb();};
  document.getElementById('confirm-modal').style.display='';
}
function closeConfirm(){document.getElementById('confirm-modal').style.display='none';}

// ═══════════════════════════════════════════════════════════
//  THEME
// ═══════════════════════════════════════════════════════════
function applyTheme(dark){
  document.body.classList.toggle('dark',dark);
  const btn=document.getElementById('theme-btn');
  if(btn){btn.textContent=dark?'☀️':'🌙';btn.title=dark?'Light mode':'Dark mode';}
}
function toggleTheme(){
  const isDark=!document.body.classList.contains('dark');
  localStorage.setItem('vault_theme',isDark?'dark':'light');
  applyTheme(isDark);
}

// ═══════════════════════════════════════════════════════════
//  MOBILE SIDEBAR
// ═══════════════════════════════════════════════════════════
function toggleMobileSidebar() {
  const sidebar  = document.querySelector('.sidebar');
  const overlay  = document.getElementById('sidebar-overlay');
  const isOpen   = sidebar.classList.contains('mobile-open');
  if (isOpen) {
    sidebar.classList.remove('mobile-open');
    overlay.classList.remove('open');
  } else {
    sidebar.classList.add('mobile-open');
    overlay.classList.add('open');
  }
}
function closeMobileSidebar() {
  document.querySelector('.sidebar')?.classList.remove('mobile-open');
  document.getElementById('sidebar-overlay')?.classList.remove('open');
}
const savedTheme=localStorage.getItem('vault_theme');
if(savedTheme==='dark'||(!savedTheme&&window.matchMedia('(prefers-color-scheme: dark)').matches)) applyTheme(true);

// ═══════════════════════════════════════════════════════════
//  BOOT
// ═══════════════════════════════════════════════════════════
load();
