import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from './supabaseClient';

const catalog = [
  { name: 'Pen', price: 10, category: 'Pens' },
  { name: 'Pencil', price: 5, category: 'Pens' },
  { name: 'Xerox (per page)', price: 2, category: 'Xerox' },
  { name: 'A4 Paper (bundle)', price: 180, category: 'Paper' },
  { name: 'Notebook - 100pg', price: 35, category: 'Notebooks' },
  { name: 'Notebook - 200pg', price: 60, category: 'Notebooks' },
  { name: 'File Cover', price: 15, category: 'Files' },
  { name: 'Stapler Pin Box', price: 20, category: 'Office Supplies' },
  { name: 'Eraser', price: 5, category: 'Pens' },
  { name: 'Geometry Box', price: 60, category: 'Art Supplies' }
];

const formatDate = (date: Date) =>
  date.toLocaleDateString('en-US', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });

const formatTime = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
};

type Bill = {
  id: number;
  created_at: string;
  total: number;
  items: string[];
};

export default function App() {
  const [screen, setScreen] = useState<'landing' | 'new' | 'reports' | 'pastBills'>('landing');
  const [bills, setBills] = useState<Bill[]>([]);
  const [itemsInput, setItemsInput] = useState('');
  const [confirmedItems, setConfirmedItems] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [totalPriceInput, setTotalPriceInput] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('Bill saved ✓');
  const [loading, setLoading] = useState(false);
  const [selectedBillToDelete, setSelectedBillToDelete] = useState<Bill | null>(null);
  const [reportTab, setReportTab] = useState<'overview' | 'items' | 'daily' | 'weekly'>('overview');
  const [menuOpen, setMenuOpen] = useState(false);
  const longPressTimeoutRef = useRef<number | null>(null);
  const toastTimeoutRef = useRef<number | null>(null);

  const longPressThreshold = 600;

  const today = useMemo(() => formatDate(new Date()), []);
  const grandTotal = useMemo(() => parseFloat(totalPriceInput) || 0, [totalPriceInput]);

  const todayTotal = useMemo(
    () => bills.reduce((sum, bill) => {
      const billDate = new Date(bill.created_at);
      const now = new Date();
      return billDate.toDateString() === now.toDateString() ? sum + bill.total : sum;
    }, 0),
    [bills]
  );

  const reportData = useMemo(() => {
    const now = new Date();
    const thisWeekStart = new Date(now);
    thisWeekStart.setDate(now.getDate() - now.getDay());
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const totalAllTime = bills.reduce((sum, b) => sum + b.total, 0);
    const totalThisMonth = bills.filter(b => new Date(b.created_at) >= thisMonthStart).reduce((sum, b) => sum + b.total, 0);
    const totalThisWeek = bills.filter(b => new Date(b.created_at) >= thisWeekStart).reduce((sum, b) => sum + b.total, 0);
    const totalToday = todayTotal;
    const avgBillValue = bills.length > 0 ? Math.round(totalAllTime / bills.length) : 0;
    const totalBills = bills.length;

    const itemCounts: Record<string, { count: number; category: string; total: number }> = {};
    bills.forEach(bill => {
      bill.items.forEach(item => {
        if (!itemCounts[item]) {
          const catalogItem = catalog.find(c => c.name === item);
          itemCounts[item] = { count: 0, category: catalogItem?.category || 'Other', total: 0 };
        }
        itemCounts[item].count += 1;
        itemCounts[item].total += bill.total / bill.items.length;
      });
    });

    const topItems = Object.entries(itemCounts)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const categoryCounts: Record<string, number> = {};
    bills.forEach(bill => {
      bill.items.forEach(item => {
        const catalogItem = catalog.find(c => c.name === item);
        const category = catalogItem?.category || 'Other';
        categoryCounts[category] = (categoryCounts[category] || 0) + 1;
      });
    });

    const dailyBreakdown: Record<string, number> = {};
    bills.forEach(bill => {
      const date = new Date(bill.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      dailyBreakdown[date] = (dailyBreakdown[date] || 0) + bill.total;
    });

    const dailyArray = Object.entries(dailyBreakdown)
      .map(([date, total]) => ({ date, total }))
      .reverse()
      .slice(0, 7);

    const weeklyBreakdown: Record<string, number> = {};
    bills.forEach(bill => {
      const billDate = new Date(bill.created_at);
      const weekStart = new Date(billDate);
      weekStart.setDate(billDate.getDate() - billDate.getDay());
      const weekLabel = `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
      weeklyBreakdown[weekLabel] = (weeklyBreakdown[weekLabel] || 0) + bill.total;
    });

    const weeklyArray = Object.entries(weeklyBreakdown)
      .map(([week, total]) => ({ week, total }))
      .reverse()
      .slice(0, 4);

    return {
      totalAllTime,
      totalThisMonth,
      totalThisWeek,
      totalToday,
      avgBillValue,
      totalBills,
      topItems,
      categoryCounts,
      dailyArray,
      weeklyArray
    };
  }, [bills, todayTotal]);


  useEffect(() => {
    fetchBills();
  }, []);

  async function fetchBills() {
    setLoading(true);
    const { data, error } = await supabase.from('bills').select('*').order('created_at', { ascending: false }).limit(20);
    setLoading(false);
    if (error) {
      console.error('Failed to fetch bills', error);
      return;
    }
    setBills((data as Bill[]) ?? []);
  }

  function showNewBill() {
    setScreen('new');
    setItemsInput('');
    setConfirmedItems([]);
    setSuggestions([]);
    setTotalPriceInput('');
  }

  function showLanding() {
    setScreen('landing');
  }

  function showReports() {
    console.log('showReports called');
    setMenuOpen(false);
    setTimeout(() => {
      setScreen('reports');
    }, 100);
  }

  function showPastBills() {
    console.log('showPastBills called');
    setMenuOpen(false);
    setTimeout(() => {
      setScreen('pastBills');
    }, 100);
  }

  const groupedBillsByDate = useMemo(() => {
    const grouped: Record<string, Bill[]> = {};
    bills.forEach(bill => {
      const date = new Date(bill.created_at);
      const dateKey = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(bill);
    });
    
    return Object.entries(grouped)
      .sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime())
      .map(([date, dayBills]) => ({
        date,
        bills: dayBills,
        total: dayBills.reduce((sum, b) => sum + b.total, 0)
      }));
  }, [bills]);

  function handleItemsInput(value: string) {
    const parts = value.split(',');
    const current = parts[parts.length - 1].trim();
    const confirmed = parts.slice(0, -1).map((item) => item.trim()).filter(Boolean);
    setConfirmedItems(confirmed);
    setItemsInput(value);
    if (!current) {
      setSuggestions([]);
      return;
    }
    const matched = catalog
      .filter((item) => item.name.toLowerCase().startsWith(current.toLowerCase()))
      .slice(0, 4)
      .map((item) => item.name);
    setSuggestions(matched);
  }

  function addSuggestedItem(name: string) {
    const updated = [...confirmedItems, name];
    const nextValue = updated.join(', ') + ', ';
    handleItemsInput(nextValue);
  }

  function showToast(message: string) {
    if (toastTimeoutRef.current !== null) {
      window.clearTimeout(toastTimeoutRef.current);
    }
    setToastMessage(message);
    setToastVisible(true);
    toastTimeoutRef.current = window.setTimeout(() => {
      setToastVisible(false);
    }, 900);
  }

  async function saveBill() {
    const leftover = itemsInput.split(',').pop()?.trim();
    const finalItems = leftover ? [...confirmedItems, leftover] : confirmedItems;
    if (finalItems.length === 0 || grandTotal <= 0) {
      return;
    }

    const { error } = await supabase.from('bills').insert([
      {
        total: grandTotal,
        items: finalItems,
        items_text: finalItems.join(', ')
      }
    ]);

    if (error) {
      console.error('Failed to save bill', error);
      return;
    }

    showToast('Bill saved ✓');
    setTimeout(() => {
      showLanding();
      fetchBills();
    }, 900);
  }

  function clearBillLongPress() {
    if (longPressTimeoutRef.current !== null) {
      window.clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }
  }

  function startBillLongPress(bill: Bill) {
    clearBillLongPress();
    longPressTimeoutRef.current = window.setTimeout(() => {
      setSelectedBillToDelete(bill);
      longPressTimeoutRef.current = null;
    }, longPressThreshold);
  }

  async function deleteSelectedBill() {
    if (!selectedBillToDelete) {
      return;
    }

    const billToDelete = selectedBillToDelete;
    setBills((current) => current.filter((bill) => bill.id !== billToDelete.id));
    setSelectedBillToDelete(null);

    const { error } = await supabase.from('bills').delete().eq('id', billToDelete.id);
    if (error) {
      console.error('Failed to delete bill', error);
      setBills((current) => [billToDelete, ...current.filter((bill) => bill.id !== billToDelete.id)]);
      showToast('Delete failed');
      return;
    }

    showToast('Bill deleted ✓');
    fetchBills();
  }

  return (
    <div className="phone">
      <div className="binding">
        {Array.from({ length: 9 }).map((_, index) => (
          <div key={index} className="hole" />
        ))}
      </div>

      <div className="screen">
        <div id="landingScreen" style={{ display: screen === 'landing' ? 'flex' : 'none', flexDirection: 'column', height: '100%' }}>
          <header className="top">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div className="shop">Dharani Stationeries</div>
              <button className="menu-btn" onClick={() => setMenuOpen(!menuOpen)}>⋯</button>
            </div>
            <div className="date" id="todayDate">{today}</div>
            <div className="total-today">
              <div className="label">Today's sales</div>
              <div className="amt">₹<span id="todayTotal">{todayTotal}</span></div>
            </div>
          </header>
          <div className="content">
            <div className="section-title">Today's bills</div>
            <div id="billsList">
              {loading && <div className="empty-note">Loading bills…</div>}
              {!loading && bills.length === 0 && <div className="empty-note">No bills yet. Tap New Bill to create the first sale.</div>}
              {!loading && bills.map((bill) => (
                <div
                  key={bill.id}
                  className="bill-card"
                  onPointerDown={() => startBillLongPress(bill)}
                  onPointerUp={clearBillLongPress}
                  onPointerLeave={clearBillLongPress}
                  onPointerCancel={clearBillLongPress}
                >
                  <div>
                    <div className="time">{formatTime(bill.created_at)}</div>
                    <div className="items">{bill.items.slice(0, 2).join(', ') || 'New bill'}</div>
                  </div>
                  <div className="amt">₹{bill.total}</div>
                </div>
              ))}
            </div>
          </div>
          <button className="fab" onClick={showNewBill}>＋ &nbsp; New Bill</button>
        </div>

        <div id="newBillScreen" style={{ display: screen === 'new' ? 'block' : 'none' }}>
          <div className="nb-header">
            <div className="back-btn" onClick={showLanding}>←</div>
            <div className="nb-title">New Bill</div>
          </div>
          <div className="content" style={{ paddingBottom: 20 }}>
            <div className="item-row">
              <span className="field-label">Items purchased</span>
              <input
                className="name-input"
                id="itemsInput"
                placeholder="Type items, comma separated: Pen, Notebook, Xerox"
                value={itemsInput}
                onChange={(event) => handleItemsInput(event.target.value)}
                autoComplete="off"
              />
              <div className="suggest-row" id="suggestBox">
                {suggestions.map((item) => (
                  <div key={item} className="chip" onClick={() => addSuggestedItem(item)}>{item}</div>
                ))}
              </div>
              <div className="suggest-row" id="chipsBox" style={{ marginTop: 2 }}>
                {confirmedItems.map((item) => (
                  <div key={item} className="chip confirmed">{item}</div>
                ))}
              </div>
            </div>

            <div className="item-row">
              <span className="field-label">Total price (₹)</span>
              <input
                type="number"
                className="price-input"
                id="totalPriceInput"
                placeholder="0"
                value={totalPriceInput}
                onChange={(event) => setTotalPriceInput(event.target.value)}
              />
            </div>
          </div>
          <div className="nb-footer">
            <div className="grand-total">
              <div className="label">Total</div>
              <div className="amt">₹<span id="grandTotal">{grandTotal}</span></div>
            </div>
            <button className="save-btn" onClick={saveBill}>✅ Save Bill</button>
          </div>
        </div>

        <div id="reportsScreen" style={{ display: screen === 'reports' ? 'flex' : 'none', flexDirection: 'column', height: '100%' }}>
          <header className="top">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div className="shop">Reports</div>
              <button className="menu-btn" onClick={() => setMenuOpen(!menuOpen)}>⋯</button>
            </div>
            <div className="date">Sales Analytics</div>
          </header>
          <div className="reports-tabs">
            <button className={`tab-btn ${reportTab === 'overview' ? 'active' : ''}`} onClick={() => setReportTab('overview')}>Overview</button>
            <button className={`tab-btn ${reportTab === 'items' ? 'active' : ''}`} onClick={() => setReportTab('items')}>Items</button>
            <button className={`tab-btn ${reportTab === 'daily' ? 'active' : ''}`} onClick={() => setReportTab('daily')}>Daily</button>
            <button className={`tab-btn ${reportTab === 'weekly' ? 'active' : ''}`} onClick={() => setReportTab('weekly')}>Weekly</button>
          </div>
          <div className="content" style={{ paddingBottom: 20 }}>
            {reportTab === 'overview' && (
              <>
                <div className="report-card">
                  <div className="report-label">All-Time Sales</div>
                  <div className="report-amount">₹{reportData.totalAllTime}</div>
                </div>
                <div className="report-card">
                  <div className="report-label">This Month</div>
                  <div className="report-amount">₹{reportData.totalThisMonth}</div>
                </div>
                <div className="report-card">
                  <div className="report-label">This Week</div>
                  <div className="report-amount">₹{reportData.totalThisWeek}</div>
                </div>
                <div className="report-card">
                  <div className="report-label">Today</div>
                  <div className="report-amount">₹{reportData.totalToday}</div>
                </div>
                <div className="report-card">
                  <div className="report-label">Total Bills</div>
                  <div className="report-amount">{reportData.totalBills}</div>
                </div>
                <div className="report-card">
                  <div className="report-label">Avg. Bill Value</div>
                  <div className="report-amount">₹{reportData.avgBillValue}</div>
                </div>
              </>
            )}
            {reportTab === 'items' && (
              <>
                <div className="section-title">Top Selling Items</div>
                {reportData.topItems.map((item) => (
                  <div key={item.name} className="item-stat">
                    <div>
                      <div className="item-name">{item.name}</div>
                      <div className="item-category">{item.category}</div>
                    </div>
                    <div className="item-count">×{item.count}</div>
                  </div>
                ))}
                <div className="section-title" style={{ marginTop: 16 }}>Categories</div>
                {Object.entries(reportData.categoryCounts)
                  .sort(([, a], [, b]) => b - a)
                  .map(([category, count]) => (
                    <div key={category} className="category-stat">
                      <div className="cat-name">{category}</div>
                      <div className="cat-count">{count} items</div>
                    </div>
                  ))}
              </>
            )}
            {reportTab === 'daily' && (
              <>
                <div className="section-title">Last 7 Days</div>
                {reportData.dailyArray.map((day) => (
                  <div key={day.date} className="daily-stat">
                    <div className="daily-date">{day.date}</div>
                    <div className="daily-bar-container">
                      <div className="daily-bar" style={{ width: `${Math.min((day.total / 500) * 100, 100)}%` }} />
                    </div>
                    <div className="daily-amount">₹{day.total}</div>
                  </div>
                ))}
              </>
            )}
            {reportTab === 'weekly' && (
              <>
                <div className="section-title">Last 4 Weeks</div>
                {reportData.weeklyArray.map((week) => (
                  <div key={week.week} className="weekly-stat">
                    <div className="weekly-label">{week.week}</div>
                    <div className="weekly-bar-container">
                      <div className="weekly-bar" style={{ width: `${Math.min((week.total / 2000) * 100, 100)}%` }} />
                    </div>
                    <div className="weekly-amount">₹{week.total}</div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        <div id="pastBillsScreen" style={{ display: screen === 'pastBills' ? 'flex' : 'none', flexDirection: 'column', height: '100%' }}>
          <header className="top">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="shop">All Bills</div>
              <div style={{ fontSize: 18, opacity: 0.8 }}>📅</div>
            </div>
            <div className="date">Grouped by date</div>
          </header>
          <div className="content">
            {loading && <div className="empty-note">Loading bills…</div>}
            {!loading && groupedBillsByDate.length === 0 && <div className="empty-note">No bills yet.</div>}
            {!loading && groupedBillsByDate.map((group) => (
              <div key={group.date}>
                <div className="date-group-header">
                  <div className="date-group-title">{group.date}</div>
                  <div className="date-group-total">₹{group.total}</div>
                </div>
                {group.bills.map((bill) => (
                  <div
                    key={bill.id}
                    className="bill-card"
                    onPointerDown={() => startBillLongPress(bill)}
                    onPointerUp={clearBillLongPress}
                    onPointerLeave={clearBillLongPress}
                    onPointerCancel={clearBillLongPress}
                  >
                    <div>
                      <div className="time">{formatTime(bill.created_at)}</div>
                      <div className="items">{bill.items.slice(0, 2).join(', ') || 'Items'}</div>
                    </div>
                    <div className="amt">₹{bill.total}</div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className={`side-nav ${menuOpen ? 'open' : ''}`}>
          <button className="side-nav-close" onClick={() => setMenuOpen(false)}>✕</button>
          <div className="side-nav-content">
            <button className="side-nav-item" onClick={showPastBills}>
              <span className="nav-icon">📅</span>
              <span className="nav-label">Past Bills</span>
            </button>
            <button className="side-nav-item" onClick={showReports}>
              <span className="nav-icon">📊</span>
              <span className="nav-label">Reports</span>
            </button>
          </div>
        </div>
        {menuOpen && <div className="side-nav-overlay" onClick={() => setMenuOpen(false)} />}
      </div>


      {selectedBillToDelete && (
        <div className="dialog-overlay" onClick={() => setSelectedBillToDelete(null)}>
          <div className="dialog-card" onClick={(event) => event.stopPropagation()}>
            <div className="dialog-title">Delete bill?</div>
            <div className="dialog-text">Long press confirmed. Remove this bill from the list?</div>
            <div className="dialog-actions">
              <button className="dialog-cancel" onClick={() => setSelectedBillToDelete(null)}>Cancel</button>
              <button className="dialog-delete" onClick={deleteSelectedBill}>Delete</button>
            </div>
          </div>
        </div>
      )}

      <div className={`toast${toastVisible ? ' show' : ''}`} id="toast">{toastMessage}</div>
    </div>
  );
}
