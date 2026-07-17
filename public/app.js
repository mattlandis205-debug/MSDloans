// State variables
let loanRates = [];
let depositRates = [];
let selectedTable = null;
let selectedRow = null;
let currentChart = null;
let currentDoughnut = null;
let isRateOverridden = false;
let isMonthlyView = false;

// DOM Elements
const categorySelect = document.getElementById('loan-category');
const productSelect = document.getElementById('loan-product');
const rateInput = document.getElementById('interest-rate');
const rateSourceTag = document.getElementById('rate-source-tag');
const defaultRateIndicator = document.getElementById('default-rate-indicator');
const overrideRateBtn = document.getElementById('override-rate-btn');

const loanAmountInput = document.getElementById('loan-amount');
const loanAmountSlider = document.getElementById('loan-amount-slider');
const sliderMinLbl = document.getElementById('slider-min-lbl');
const sliderMaxLbl = document.getElementById('slider-max-lbl');

const customTermInput = document.getElementById('custom-term');
const customTermSlider = document.getElementById('custom-term-slider');

const downPaymentGroup = document.getElementById('down-payment-group');
const downPaymentInput = document.getElementById('down-payment');
const downPaymentSlider = document.getElementById('down-payment-slider');

const ltvGroup = document.getElementById('ltv-group');
const ltvSelect = document.getElementById('ltv-select');

const extraPaymentInput = document.getElementById('extra-payment');
const extraPaymentSlider = document.getElementById('extra-payment-slider');

const monthlyPaymentVal = document.getElementById('monthly-payment-val');
const totalInterestVal = document.getElementById('total-interest-val');
const totalCostVal = document.getElementById('total-cost-val');
const payoffDateVal = document.getElementById('payoff-date-val');

const savingsBox = document.getElementById('savings-box');
const savingsExtraVal = document.getElementById('savings-extra-val');
const savingsInterestVal = document.getElementById('savings-interest-val');
const savingsTimeVal = document.getElementById('savings-time-val');

const competitorRateVal = document.getElementById('competitor-rate');
const competitorSavingsVal = document.getElementById('competitor-savings');

const disclaimerContent = document.getElementById('disclaimer-content');
const disclaimerTitle = document.getElementById('disclaimer-title');
const rateEffectiveBadge = document.getElementById('rate-effective-badge');
const refreshRatesBtn = document.getElementById('refresh-rates-btn');

const tableTbody = document.getElementById('amortization-tbody');
const toggleScheduleViewBtn = document.getElementById('toggle-schedule-view-btn');
const downloadScheduleBtn = document.getElementById('download-schedule-btn');

const breakdownPrincipalPercent = document.getElementById('breakdown-principal-percent');
const breakdownInterestPercent = document.getElementById('breakdown-interest-percent');

// Fetch live rates on startup
async function fetchRates() {
  rateEffectiveBadge.innerHTML = 'Connecting to MSDFCU...';
  try {
    const response = await fetch('/api/rates');
    if (!response.ok) throw new Error('API request failed');
    const data = await response.json();
    
    loanRates = data.loans || [];
    depositRates = data.deposits || [];
    
    if (data.effectiveDateLoans) {
      rateEffectiveBadge.innerHTML = `Rates effective as of ${data.effectiveDateLoans}`;
    } else {
      rateEffectiveBadge.innerHTML = 'Live Rates Synced';
    }
    
    populateCategories();
  } catch (error) {
    console.error('Error fetching rates:', error);
    rateEffectiveBadge.innerHTML = 'Offline Mode (Rates unavailable)';
    // Fallback static mock data to keep simulator operational if connection is lost
    loadFallbackRates();
  }
}

// Manual Refresh
refreshRatesBtn.addEventListener('click', async () => {
  const icon = refreshRatesBtn.querySelector('i');
  icon.style.transform = 'rotate(360deg)';
  icon.style.transition = 'transform 0.8s ease';
  
  rateEffectiveBadge.innerHTML = 'Refreshing daily rates...';
  try {
    const response = await fetch('/api/rates/refresh', { method: 'POST' });
    if (!response.ok) throw new Error('Refresh failed');
    const data = await response.json();
    
    loanRates = data.rates.loans || [];
    depositRates = data.rates.deposits || [];
    
    if (data.rates.effectiveDateLoans) {
      rateEffectiveBadge.innerHTML = `Rates effective as of ${data.rates.effectiveDateLoans}`;
    } else {
      rateEffectiveBadge.innerHTML = 'Live Rates Refreshed';
    }
    
    populateCategories();
    triggerSimulation();
  } catch (error) {
    console.error('Error refreshing rates:', error);
    rateEffectiveBadge.innerHTML = 'Refresh failed. Using cached rates.';
  }
  
  setTimeout(() => {
    icon.style.transform = 'none';
    icon.style.transition = 'none';
  }, 800);
});

// Fallback Mock Rates if API fails
function loadFallbackRates() {
  loanRates = [
    {
      id: "NewUsedVehicleLoans",
      title: "New & Used Vehicle Loans",
      headers: ["Terms", "APR*"],
      rows: [
        ["Up to 60 Months*", "4.99%"],
        ["61 to 72 Months*", "5.24%"],
        ["73 to 84 Months*", "5.74%"]
      ],
      disclaimer: "Estimated monthly payment per $1,000 borrowed at 4.99% APR is $18.87. Model years 2019-2026."
    },
    {
      id: "HomeEquityLoans",
      title: "Home Equity Loans",
      headers: ["Terms", "APR (Up to 80% LTV)", "APR (Up to 81% TO 90% LTV)"],
      rows: [
        ["5-Year Home Equity", "5.24%", "5.74%"],
        ["7-Year Home Equity", "5.49%", "5.99%"],
        ["10-Year Home Equity", "5.74%", "6.24%"],
        ["15-Year Home Equity", "5.99%", "6.49%"]
      ],
      disclaimer: "Home equity loans are subject to a $150 fee. Maximum LTV is 90%."
    },
    {
      id: "MortgageRate",
      title: "Mortgage Rate",
      headers: ["Term", "Rate", "APR*", "Points"],
      rows: [
        ["30 Year Fixed", "6.625%", "6.688%", "0"]
      ],
      disclaimer: "Mortgage details assume $180,000 loan with property value of $300,000 in Bucks County, PA."
    },
    {
      id: "PersonalLoanSpecials",
      title: "Personal Loan Specials",
      headers: ["Terms", "APR*"],
      rows: [
        ["up to $75,000 and up to 4 years", "6.49%"],
        ["5-Year (60 month)", "7.49%"],
        ["6-Year (72 month)", "7.49%"],
        ["7-Year (84 month)", "7.49%"]
      ],
      disclaimer: "Personal loan rates subject to credit approval. Quick payouts."
    }
  ];
  populateCategories();
}

// Populate Category Dropdown
function populateCategories() {
  categorySelect.innerHTML = '<option value="" disabled selected>-- Select a Loan Category --</option>';
  
  loanRates.forEach(table => {
    // Only display tables that have actual rates rows (skip informational headings)
    if (table.rows && table.rows.length > 0) {
      const option = document.createElement('option');
      option.value = table.id;
      option.textContent = table.title;
      categorySelect.appendChild(option);
    }
  });
}

// Category Change Event Handler
categorySelect.addEventListener('change', () => {
  const categoryId = categorySelect.value;
  selectedTable = loanRates.find(t => t.id === categoryId);
  
  if (selectedTable) {
    populateProducts(selectedTable);
    productSelect.disabled = false;
    
    // Set dynamic slider limits and down payment defaults based on category
    adjustSettingsForCategory(categoryId);
  }
});

// Populate Product Selection (Terms & Row details)
function populateProducts(table) {
  productSelect.innerHTML = '<option value="" disabled selected>-- Select Product / Term --</option>';
  
  table.rows.forEach((row, idx) => {
    const option = document.createElement('option');
    option.value = idx;
    
    // Auto detect display format: first cell is usually product type or term
    let label = row[0];
    let rate = 'N/A';
    
    // Try to find the APR column index
    let rateIdx = table.headers.findIndex(h => h.includes('APR') || h.includes('Rate'));
    if (rateIdx === -1) rateIdx = 1; // fallback
    
    if (row[rateIdx]) {
      rate = row[rateIdx];
    }
    
    option.textContent = `${label} (${rate})`;
    productSelect.appendChild(option);
  });
}

// Adjust UI configurations based on the selected category
function adjustSettingsForCategory(catId) {
  // Show/Hide down payment
  if (catId.includes('Vehicle') || catId.includes('Auto') || catId.includes('Motorcycle') || catId.includes('RV')) {
    downPaymentGroup.classList.remove('hidden');
  } else {
    downPaymentGroup.classList.add('hidden');
    downPaymentInput.value = 0;
    downPaymentSlider.value = 0;
  }
  
  // Show/Hide LTV modifier (Home Equity)
  if (catId.includes('HomeEquityLoans')) {
    ltvGroup.classList.remove('hidden');
  } else {
    ltvGroup.classList.add('hidden');
  }
  
  // Adjust Borrowing sliders
  if (catId.includes('Mortgage')) {
    setSliderRange(loanAmountSlider, 50000, 800000, 5000, 250000);
    loanAmountInput.value = 250000;
  } else if (catId.includes('HomeEquity')) {
    setSliderRange(loanAmountSlider, 10000, 250000, 2500, 50000);
    loanAmountInput.value = 50000;
  } else if (catId.includes('Personal')) {
    setSliderRange(loanAmountSlider, 1000, 50000, 500, 10000);
    loanAmountInput.value = 10000;
  } else {
    // Default values (Vehicle, Collateralized, etc)
    setSliderRange(loanAmountSlider, 2000, 100000, 500, 30000);
    loanAmountInput.value = 30000;
  }
  
  syncDownPaymentSliderMax();
}

function setSliderRange(slider, min, max, step, val) {
  slider.min = min;
  slider.max = max;
  slider.step = step;
  slider.value = val;
  sliderMinLbl.textContent = `$${min.toLocaleString()}`;
  sliderMaxLbl.textContent = `$${max.toLocaleString()}`;
}

// Product Selection Change
productSelect.addEventListener('change', () => {
  const idx = parseInt(productSelect.value);
  selectedRow = selectedTable.rows[idx];
  
  if (selectedRow) {
    isRateOverridden = false;
    rateSourceTag.textContent = "Official Daily Rate";
    rateSourceTag.className = "badge";
    rateInput.disabled = true;
    
    // Automatically parse APR and default terms
    const apr = parseAPRFromRow(selectedRow, selectedTable.headers);
    const term = parseTermFromRow(selectedRow[0]);
    
    rateInput.value = apr;
    defaultRateIndicator.textContent = `Official rate is ${apr}% APR. Click custom to edit.`;
    
    customTermInput.value = term;
    customTermSlider.value = term;
    
    // Display dynamic disclaimers
    disclaimerTitle.textContent = `MSDFCU ${selectedTable.title} Disclosures`;
    disclaimerContent.innerHTML = selectedTable.disclaimer || "Rates subject to credit vetting and profile requirements. Rates subject to change without notice.";
    
    triggerSimulation();
  }
});

// Rate parse utils
function parseAPRFromRow(row, headers) {
  // Check LTV selector first if category is Home Equity
  if (categorySelect.value.includes('HomeEquityLoans')) {
    const isHighLTV = ltvSelect.value === "90";
    if (isHighLTV && row[2]) {
      return parseFloat(row[2].replace(/[^\d\.]/g, ''));
    } else {
      return parseFloat(row[1].replace(/[^\d\.]/g, ''));
    }
  }
  
  // Normal lookup
  let rateIdx = headers.findIndex(h => h.includes('APR') || h.includes('Rate'));
  if (rateIdx === -1) rateIdx = 1;
  
  const cellVal = row[rateIdx] || '';
  
  // Handle range like "13.40% - 18.00%"
  if (cellVal.includes('-')) {
    const parts = cellVal.split('-');
    return parseFloat(parts[0].replace(/[^\d\.]/g, '')); // return "as low as" rate
  }
  
  return parseFloat(cellVal.replace(/[^\d\.]/g, '')) || 5.0;
}

function parseTermFromRow(text) {
  const clean = text.toLowerCase();
  
  // Look for months
  const monthMatch = clean.match(/(\d+)\s*month/);
  if (monthMatch) return parseInt(monthMatch[1]);
  
  // Look for years
  const yearMatch = clean.match(/(\d+)-?\s*year/);
  if (yearMatch) return parseInt(yearMatch[1]) * 12;
  
  // RV Loans exceptions
  if (clean.includes('5, 7, 10 years')) return 120;
  if (clean.includes('15 and 20 years')) return 240;
  
  return 60; // default
}

// Dynamic LTV change updates rate
ltvSelect.addEventListener('change', () => {
  if (selectedRow) {
    const apr = parseAPRFromRow(selectedRow, selectedTable.headers);
    rateInput.value = apr;
    if (!isRateOverridden) {
      defaultRateIndicator.textContent = `Official rate updated for ${ltvSelect.options[ltvSelect.selectedIndex].text}: ${apr}% APR.`;
    }
    triggerSimulation();
  }
});

// Custom Override rate trigger
overrideRateBtn.addEventListener('click', () => {
  isRateOverridden = !isRateOverridden;
  if (isRateOverridden) {
    rateInput.disabled = false;
    rateInput.focus();
    rateSourceTag.textContent = "Custom Rate";
    rateSourceTag.className = "badge custom";
    overrideRateBtn.innerHTML = '<i data-lucide="x"></i> Reset';
  } else {
    rateInput.disabled = true;
    rateSourceTag.textContent = "Official Daily Rate";
    rateSourceTag.className = "badge";
    overrideRateBtn.innerHTML = '<i data-lucide="edit-3"></i> Custom';
    if (selectedRow) {
      const apr = parseAPRFromRow(selectedRow, selectedTable.headers);
      rateInput.value = apr;
    }
  }
  lucide.createIcons();
  triggerSimulation();
});

rateInput.addEventListener('input', () => {
  if (isRateOverridden) triggerSimulation();
});

// Bidirectional Input + Slider Synchronization
function setupSync(input, slider, callback) {
  input.addEventListener('input', () => {
    let val = parseFloat(input.value) || 0;
    if (val < parseFloat(slider.min)) val = parseFloat(slider.min);
    if (val > parseFloat(slider.max)) val = parseFloat(slider.max);
    slider.value = val;
    if (callback) callback();
    triggerSimulation();
  });
  
  slider.addEventListener('input', () => {
    input.value = slider.value;
    if (callback) callback();
    triggerSimulation();
  });
}

function syncDownPaymentSliderMax() {
  const maxDown = Math.min(50000, parseFloat(loanAmountInput.value) || 10000);
  downPaymentSlider.max = maxDown;
  if (parseFloat(downPaymentInput.value) > maxDown) {
    downPaymentInput.value = maxDown;
    downPaymentSlider.value = maxDown;
  }
}

setupSync(loanAmountInput, loanAmountSlider, () => {
  syncDownPaymentSliderMax();
});

setupSync(downPaymentInput, downPaymentSlider);
setupSync(customTermInput, customTermSlider);
setupSync(extraPaymentInput, extraPaymentSlider);

// Tab Navigation
const tabButtons = document.querySelectorAll('.tab-btn');
const tabPanels = document.querySelectorAll('.tab-panel');

tabButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    tabButtons.forEach(b => b.classList.remove('active'));
    tabPanels.forEach(p => p.classList.remove('active'));
    
    btn.classList.add('active');
    const tabId = btn.getAttribute('data-tab');
    document.getElementById(tabId).classList.add('active');
    
    // Trigger charts update to handle canvas resizing bugs
    if (tabId === 'payoff-tab' && currentChart) currentChart.resize();
    if (tabId === 'compare-tab' && currentDoughnut) currentDoughnut.resize();
  });
});

// Table details view toggle
toggleScheduleViewBtn.addEventListener('click', () => {
  isMonthlyView = !isMonthlyView;
  if (isMonthlyView) {
    toggleScheduleViewBtn.innerHTML = '<i data-lucide="eye-off"></i> Show Yearly Summary';
  } else {
    toggleScheduleViewBtn.innerHTML = '<i data-lucide="eye"></i> Show Monthly Details';
  }
  lucide.createIcons();
  triggerSimulation();
});

// CSV Downloader
downloadScheduleBtn.addEventListener('click', () => {
  const P = Math.max(0, (parseFloat(loanAmountInput.value) || 0) - (parseFloat(downPaymentInput.value) || 0));
  const rateVal = parseFloat(rateInput.value) || 0;
  const termVal = parseInt(customTermInput.value) || 12;
  const extraVal = parseFloat(extraPaymentInput.value) || 0;
  
  const schedule = calculateSchedule(P, rateVal, termVal, extraVal);
  
  let csvContent = "data:text/csv;charset=utf-8,";
  csvContent += "Payment #,Beginning Balance,Payment,Principal Paid,Interest Paid,Extra Payment,Ending Balance,Cumulative Interest\n";
  
  schedule.monthly.forEach((m) => {
    csvContent += `${m.month},${m.begBalance.toFixed(2)},${m.payment.toFixed(2)},${m.principal.toFixed(2)},${m.interest.toFixed(2)},${m.extra.toFixed(2)},${m.endBalance.toFixed(2)},${m.cumInterest.toFixed(2)}\n`;
  });
  
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `MSDFCU_Amortization_Schedule_${termVal}mo.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
});

// CORE MATHEMATICAL SIMULATION
function triggerSimulation() {
  const P = Math.max(0, (parseFloat(loanAmountInput.value) || 0) - (parseFloat(downPaymentInput.value) || 0));
  const rateVal = parseFloat(rateInput.value) || 0;
  const termVal = parseInt(customTermInput.value) || 12;
  const extraVal = parseFloat(extraPaymentInput.value) || 0;
  
  // Calculate Base Scenario (No Extra Payments)
  const baseSchedule = calculateSchedule(P, rateVal, termVal, 0);
  
  // Calculate Accelerated Scenario (With Extra Payments)
  const activeSchedule = calculateSchedule(P, rateVal, termVal, extraVal);
  
  // Render KPI values
  monthlyPaymentVal.textContent = `$${activeSchedule.monthlyPayment.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  totalInterestVal.textContent = `$${activeSchedule.totalInterest.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  totalCostVal.textContent = `$${(P + activeSchedule.totalInterest).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  
  // Dynamic Payoff Date
  const payoffMonths = activeSchedule.monthly.length;
  const payoffDate = new Date();
  payoffDate.setMonth(payoffDate.getMonth() + payoffMonths);
  payoffDateVal.textContent = payoffDate.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
  
  // Competitor Savings Calculations
  const bankAPR = rateVal + 3.25; // banks average roughly 3% higher than credit unions
  const bankSchedule = calculateSchedule(P, bankAPR, termVal, 0);
  const savingsAmount = bankSchedule.totalInterest - activeSchedule.totalInterest;
  competitorRateVal.textContent = `${bankAPR.toFixed(2)}%`;
  competitorSavingsVal.textContent = `$${Math.max(0, savingsAmount).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  
  // Acceleration alert display
  if (extraVal > 0 && payoffMonths < termVal) {
    savingsBox.classList.remove('hidden');
    savingsExtraVal.textContent = `$${extraVal.toLocaleString()}`;
    
    const interestSaved = baseSchedule.totalInterest - activeSchedule.totalInterest;
    savingsInterestVal.textContent = `$${Math.max(0, interestSaved).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
    
    const monthsSaved = termVal - payoffMonths;
    savingsTimeVal.textContent = `${monthsSaved} month${monthsSaved > 1 ? 's' : ''}`;
  } else {
    savingsBox.classList.add('hidden');
  }
  
  // Populate Amortization Table
  populateTable(activeSchedule);
  
  // Update Payoff Charts & Doughnuts
  renderPayoffChart(activeSchedule, baseSchedule);
  renderDoughnutChart(P, activeSchedule.totalInterest);
}

// Amortization Schedule Engine
function calculateSchedule(principal, annualRate, termMonths, extraPayment) {
  const r = annualRate / 12 / 100;
  let monthlyPayment = 0;
  
  if (r === 0) {
    monthlyPayment = principal / termMonths;
  } else {
    monthlyPayment = principal * (r * Math.pow(1 + r, termMonths)) / (Math.pow(1 + r, termMonths) - 1);
  }
  
  const monthly = [];
  let balance = principal;
  let cumInterest = 0;
  
  for (let month = 1; month <= termMonths; month++) {
    if (balance <= 0) break;
    
    const interest = balance * r;
    let actualPayment = monthlyPayment;
    let principalPaid = actualPayment - interest;
    
    // Add extra payment
    let extraApplied = extraPayment;
    if (balance < (principalPaid + extraApplied)) {
      extraApplied = Math.max(0, balance - principalPaid);
    }
    
    let totalPrincipal = principalPaid + extraApplied;
    if (balance < totalPrincipal) {
      totalPrincipal = balance;
      principalPaid = balance - extraApplied;
      actualPayment = principalPaid + interest;
    }
    
    cumInterest += interest;
    const begBalance = balance;
    balance -= totalPrincipal;
    
    monthly.push({
      month,
      begBalance,
      payment: actualPayment,
      principal: principalPaid,
      interest,
      extra: extraApplied,
      endBalance: Math.max(0, balance),
      cumInterest
    });
  }
  
  // Aggregate into yearly intervals
  const yearly = [];
  let yearlyBegBalance = principal;
  let yearlyPrincipal = 0;
  let yearlyInterest = 0;
  let yearlyExtra = 0;
  
  monthly.forEach((m, idx) => {
    yearlyPrincipal += m.principal;
    yearlyInterest += m.interest;
    yearlyExtra += m.extra;
    
    if (m.month % 12 === 0 || idx === monthly.length - 1) {
      yearly.push({
        year: Math.ceil(m.month / 12),
        begBalance: yearlyBegBalance,
        principal: yearlyPrincipal,
        interest: yearlyInterest,
        extra: yearlyExtra,
        endBalance: m.endBalance
      });
      yearlyBegBalance = m.endBalance;
      yearlyPrincipal = 0;
      yearlyInterest = 0;
      yearlyExtra = 0;
    }
  });
  
  const totalInterest = monthly.reduce((acc, m) => acc + m.interest, 0);
  
  return {
    monthlyPayment,
    totalInterest,
    monthly,
    yearly
  };
}

// Render schedule inside table DOM
function populateTable(schedule) {
  tableTbody.innerHTML = '';
  const dataset = isMonthlyView ? schedule.monthly : schedule.yearly;
  const labelPrefix = isMonthlyView ? 'Month ' : 'Year ';
  
  dataset.forEach(row => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${labelPrefix}${row.month || row.year}</strong></td>
      <td>$${row.begBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      <td>$${row.principal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      <td>$${row.interest.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      <td>$${row.extra.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      <td>$${row.endBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
    `;
    tableTbody.appendChild(tr);
  });
}

// Render Line Chart
function renderPayoffChart(active, base) {
  const ctx = document.getElementById('amortizationChart').getContext('2d');
  
  // Format labels & values
  const labels = active.monthly.map(m => `Month ${m.month}`);
  const balanceData = active.monthly.map(m => m.endBalance);
  
  // We align base scenario balance data with active schedule length to compare
  const baseBalanceData = base.monthly.map(m => m.endBalance).slice(0, labels.length);
  
  const cumInterestData = active.monthly.map(m => m.cumInterest);
  
  if (currentChart) {
    currentChart.destroy();
  }
  
  // Detect if dark mode is active to format labels appropriately
  const isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const gridColor = isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)';
  const labelColor = isDarkMode ? '#94a3b8' : '#64748b';
  
  currentChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Accelerated Balance',
          data: balanceData,
          borderColor: '#aabc5b', // Lime Green
          backgroundColor: 'rgba(170, 188, 91, 0.05)',
          fill: true,
          tension: 0.1,
          borderWidth: 3
        },
        {
          label: 'Original Balance Plan',
          data: baseBalanceData,
          borderColor: '#001489', // Navy Blue
          borderDash: [5, 5],
          fill: false,
          tension: 0.1,
          borderWidth: 2
        },
        {
          label: 'Interest Accrued',
          data: cumInterestData,
          borderColor: '#7f9337', // Olive Green
          fill: false,
          tension: 0.1,
          borderWidth: 2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        legend: {
          position: 'top',
          labels: {
            font: { family: 'Outfit', weight: '600' },
            color: isDarkMode ? '#f8fafc' : '#1e293b'
          }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              let label = context.dataset.label || '';
              if (label) label += ': ';
              if (context.parsed.y !== null) {
                label += new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(context.parsed.y);
              }
              return label;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            color: labelColor,
            maxTicksLimit: 12
          }
        },
        y: {
          grid: { color: gridColor },
          ticks: {
            color: labelColor,
            callback: function(value) {
              return '$' + value.toLocaleString();
            }
          }
        }
      }
    }
  });
}

// Render Doughnut Chart
function renderDoughnutChart(principal, totalInterest) {
  const ctx = document.getElementById('breakdownChart').getContext('2d');
  
  const total = principal + totalInterest;
  const principalPct = total > 0 ? (principal / total * 100).toFixed(1) : 0;
  const interestPct = total > 0 ? (totalInterest / total * 100).toFixed(1) : 0;
  
  breakdownPrincipalPercent.textContent = `${principalPct}%`;
  breakdownInterestPercent.textContent = `${interestPct}%`;
  
  if (currentDoughnut) {
    currentDoughnut.destroy();
  }
  
  const isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
  
  currentDoughnut = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Principal Paid', 'Interest Paid'],
      datasets: [{
        data: [principal, totalInterest],
        backgroundColor: [
          '#001489', // Navy Blue
          '#7f9337'  // Olive Green
        ],
        hoverOffset: 4,
        borderWidth: isDarkMode ? 2 : 1,
        borderColor: isDarkMode ? '#1e293b' : '#fff'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      cutout: '70%'
    }
  });
}

// Trigger initial fetches
fetchRates();
