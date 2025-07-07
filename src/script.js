// Main Application Logic for Fish Business App
class FishApp {
    constructor() {
        this.currentDate = this.formatDate(new Date());
        this.fishPrices = {};
        this.customers = [];
        this.dailyTransactions = {};
        this.fishStock = {};
        this.kasBonData = {};
        this.originalCustomerOrder = [];
        this.searchTimeout = null;
        
        this.init();
    }

    async init() {
        // Wait for database to be ready
        await new Promise(resolve => {
            const checkDB = () => {
                if (window.fishDB && window.fishDB.db) {
                    resolve();
                } else {
                    setTimeout(checkDB, 100);
                }
            };
            checkDB();
        });

        this.setupEventListeners();
        await this.loadData();
        this.render();
        this.updateCurrentDate();
    }

    formatDate(date) {
        return date.toISOString().split('T')[0];
    }

    formatDateDisplay(dateStr) {
        const date = new Date(dateStr);
        return date.toLocaleDateString('id-ID', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }

    formatCurrency(amount) {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0
        }).format(amount);
    }

    // Format number with thousand separators
    formatNumber(number) {
        return new Intl.NumberFormat('id-ID').format(number);
    }

    // Format number input dengan pemisah ribuan
    formatNumberInput(value) {
        if (value === '' || value === null || value === undefined) {
            return '';
        }
        // Convert to number and back to remove any existing formatting
        const number = parseInt(value.toString().replace(/\D/g, '')) || 0;
        if (number === 0) return '';
        
        // Add thousand separators using Indonesian format
        return number.toLocaleString('id-ID');
    }

    // Parse formatted number input back to integer
    parseNumberInput(formattedValue) {
        if (formattedValue === '' || formattedValue === null || formattedValue === undefined) {
            return null;
        }
        // Remove all non-digit characters and convert to integer
        const cleanValue = formattedValue.toString().replace(/\D/g, '');
        return cleanValue === '' ? null : parseInt(cleanValue);
    }

    async loadData() {
        try {
            // Load fish prices
            const prices = await window.fishDB.getFishPrices();
            this.fishPrices = {};
            prices.forEach(price => {
                this.fishPrices[price.name] = price.price;
            });

            // Load customers
            const rawCustomers = await window.fishDB.getCustomers();
            // Sort customers alphabetically by name
            this.customers = rawCustomers.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
            this.originalCustomerOrder = [...this.customers]; // Save original alphabetical order

            // Load daily transactions
            const transactions = await window.fishDB.getDailyTransactions(this.currentDate);
            this.dailyTransactions = {};
            transactions.forEach(transaction => {
                this.dailyTransactions[transaction.customerId] = transaction;
            });

            // Load fish stock
            this.fishStock = await window.fishDB.getFishStock(this.currentDate);

            // Load kas bon data
            const kasBonList = await window.fishDB.getAllKasBon();
            this.kasBonData = {};
            kasBonList.forEach(kb => {
                this.kasBonData[kb.customerId] = kb.amount;
            });

        } catch (error) {
            console.error('Error loading data:', error);
            this.showError('Gagal memuat data');
        }
    }

    setupEventListeners() {
        // Header buttons
        document.getElementById('downloadBtn').addEventListener('click', () => this.downloadReport());
        
        // Price section buttons
        document.getElementById('editPriceBtn').addEventListener('click', () => this.openPriceModal());
        document.getElementById('addPriceBtn').addEventListener('click', () => this.openAddPriceModal());
        
        // Customer management buttons
        document.getElementById('addCustomerBtn').addEventListener('click', () => this.openCustomerModal());
        document.getElementById('editCustomerBtn').addEventListener('click', () => this.openEditCustomerModal());
        document.getElementById('calculatorBtn').addEventListener('click', () => this.openCalculatorModal());
        
        // Search customer field
        this.setupSearchField();
        
        // Modal close buttons
        document.querySelectorAll('.close').forEach(closeBtn => {
            closeBtn.addEventListener('click', (e) => {
                const modal = e.target.closest('.modal');
                this.closeModal(modal);
            });
        });

        // Modal cancel buttons
        document.getElementById('cancelPriceEdit').addEventListener('click', () => this.closeModal(document.getElementById('priceModal')));
        document.getElementById('cancelCustomer').addEventListener('click', () => this.closeModal(document.getElementById('customerModal')));

        // Modal save buttons
        document.getElementById('savePriceEdit').addEventListener('click', () => this.savePriceChanges());
        document.getElementById('saveCustomer').addEventListener('click', () => this.saveCustomer());
        
        // Modal delete button
        document.getElementById('deleteCustomer').addEventListener('click', () => this.deleteCustomer());

        // Calculator
        this.setupCalculator();

        // Click outside modal to close
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeModal(modal);
                }
            });
        });
    }

    setupSearchField() {
        const searchField = document.getElementById('searchCustomerField');
        
        searchField.addEventListener('input', (e) => {
            const searchTerm = e.target.value.trim().toLowerCase();
            
            // Clear previous timeout
            if (this.searchTimeout) {
                clearTimeout(this.searchTimeout);
            }

            if (searchTerm === '') {
                // Reset to original order when search is empty
                this.resetCustomerOrder();
                return;
            }

            // Debounce search to avoid too many operations
            this.searchTimeout = setTimeout(() => {
                this.searchAndReorderCustomers(searchTerm);
            }, 300);
        });

        // Reset order when field is cleared or loses focus
        searchField.addEventListener('blur', (e) => {
            if (e.target.value.trim() === '') {
                setTimeout(() => {
                    this.resetCustomerOrder();
                }, 2000); // Wait 2 seconds before resetting
            }
        });
    }

    searchAndReorderCustomers(searchTerm) {
        // Find matching customers
        const matchingCustomers = this.customers.filter(customer => 
            customer.name.toLowerCase().includes(searchTerm)
        );

        const nonMatchingCustomers = this.customers.filter(customer => 
            !customer.name.toLowerCase().includes(searchTerm)
        );

        if (matchingCustomers.length > 0) {
            // Reorder: matching customers first, then others
            this.customers = [...matchingCustomers, ...nonMatchingCustomers];
            this.renderCustomerTable();
            
            // Highlight and scroll to first match
            setTimeout(() => {
                this.highlightSearchResults(matchingCustomers);
            }, 100);
        }
    }

    highlightSearchResults(matchingCustomers) {
        // Remove previous highlights
        document.querySelectorAll('.customer-table tr.search-highlighted').forEach(row => {
            row.classList.remove('search-highlighted');
        });

        // Highlight matching customers
        matchingCustomers.forEach(customer => {
            const row = document.querySelector(`tr:has([data-customer="${customer.id}"])`);
            if (row) {
                row.classList.add('search-highlighted');
            }
        });

        // Scroll to first matching customer
        if (matchingCustomers.length > 0) {
            const firstRow = document.querySelector(`tr:has([data-customer="${matchingCustomers[0].id}"])`);
            if (firstRow) {
                firstRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    }

    resetCustomerOrder() {
        // Reset to original alphabetical order
        this.customers = [...this.originalCustomerOrder];
        this.renderCustomerTable();
        
        // Remove highlights
        document.querySelectorAll('.customer-table tr.search-highlighted').forEach(row => {
            row.classList.remove('search-highlighted');
        });
    }

    updateCurrentDate() {
        document.getElementById('currentDate').textContent = this.formatDateDisplay(this.currentDate);
    }

    render() {
        this.renderPrices();
        this.renderStock();
        this.renderCustomerTable();
    }

    renderPrices() {
        const priceGrid = document.getElementById('priceGrid');
        priceGrid.innerHTML = '';

        Object.entries(this.fishPrices).forEach(([fishName, price]) => {
            const priceItem = document.createElement('div');
            priceItem.className = 'price-item';
            priceItem.innerHTML = `
                <h4>${fishName}</h4>
                <div class="price-value">${this.formatCurrency(price)}</div>
            `;
            priceGrid.appendChild(priceItem);
        });
    }

    renderStock() {
        const fishTypes = ['Mas', 'Nila', 'Mujair', 'Lele Daging', 'Lele BS', 'Bawal'];
        
        // Stock In - dengan input field
        const stockInGrid = document.getElementById('stockInGrid');
        stockInGrid.innerHTML = '';
        fishTypes.forEach(fishType => {
            const stockItem = document.createElement('div');
            stockItem.className = `stock-item ${fishType.toLowerCase().replace(' ', '-')}`;
            stockItem.innerHTML = `
                <span>${fishType}</span>
                <input type="number" class="stock-input" data-fish="${fishType}" value="${this.fishStock.stockIn?.[fishType] || ''}" min="0" placeholder="0">
            `;
            stockInGrid.appendChild(stockItem);
        });

        // Stock Out - display only
        const stockOutGrid = document.getElementById('stockOutGrid');
        stockOutGrid.innerHTML = '';
        fishTypes.forEach(fishType => {
            const stockItem = document.createElement('div');
            stockItem.className = `stock-item ${fishType.toLowerCase().replace(' ', '-')}`;
            stockItem.innerHTML = `
                <span>${fishType}</span>
                <span class="stock-value">${this.formatNumber(this.fishStock.stockOut?.[fishType] || 0)}</span>
            `;
            stockOutGrid.appendChild(stockItem);
        });

        // Stock Dead - dengan input field  
        const stockDeadGrid = document.getElementById('stockDeadGrid');
        stockDeadGrid.innerHTML = '';
        fishTypes.forEach(fishType => {
            const stockItem = document.createElement('div');
            stockItem.className = `stock-item ${fishType.toLowerCase().replace(' ', '-')}`;
            stockItem.innerHTML = `
                <span>${fishType}</span>
                <input type="number" class="stock-dead-input" data-fish="${fishType}" value="${this.fishStock.stockDead?.[fishType] || ''}" min="0" placeholder="0">
            `;
            stockDeadGrid.appendChild(stockItem);
        });

        // Stock Remaining - calculated (Masuk - Keluar - Mati)
        const stockRemainingGrid = document.getElementById('stockRemainingGrid');
        stockRemainingGrid.innerHTML = '';
        fishTypes.forEach(fishType => {
            const stockItem = document.createElement('div');
            stockItem.className = `stock-item ${fishType.toLowerCase().replace(' ', '-')}`;
            stockItem.innerHTML = `
                <span>${fishType}</span>
                <span class="stock-value">${this.formatNumber(this.fishStock.stockRemaining?.[fishType] || 0)}</span>
            `;
            stockRemainingGrid.appendChild(stockItem);
        });

        // Setup event listeners for stock inputs
        this.setupStockEventListeners();
    }

    setupStockEventListeners() {
        // Stock In inputs
        document.querySelectorAll('.stock-input').forEach(input => {
            input.addEventListener('input', (e) => {
                const fishType = e.target.dataset.fish;
                const quantity = parseInt(e.target.value) || 0;
                
                // Update stock in data
                if (!this.fishStock.stockIn) {
                    this.fishStock.stockIn = {};
                }
                
                if (quantity === 0) {
                    this.fishStock.stockIn[fishType] = 0;
                } else {
                    this.fishStock.stockIn[fishType] = quantity;
                }
                
                this.updateStockCalculations();
            });
        });

        // Stock Dead inputs
        document.querySelectorAll('.stock-dead-input').forEach(input => {
            input.addEventListener('input', (e) => {
                const fishType = e.target.dataset.fish;
                const quantity = parseInt(e.target.value) || 0;
                
                // Update stock dead data
                if (!this.fishStock.stockDead) {
                    this.fishStock.stockDead = {};
                }
                
                if (quantity === 0) {
                    this.fishStock.stockDead[fishType] = 0;
                } else {
                    this.fishStock.stockDead[fishType] = quantity;
                }
                
                this.updateStockCalculations();
            });
        });
    }

    renderCustomerTable() {
        const tbody = document.getElementById('customerTableBody');
        tbody.innerHTML = '';

        this.customers.forEach(customer => {
            const row = document.createElement('tr');
            const transaction = this.dailyTransactions[customer.id];
            const currentKasBon = this.kasBonData[customer.id] || 0;
            
            const fishData = transaction?.fishData || {};
            const total = this.calculateTotal(fishData);
            const bayar = transaction?.bayar || null;
            
            // Add class if customer has kas bon
            if (currentKasBon > 0) {
                row.classList.add('has-kasbon');
            }

            row.innerHTML = `
                <td>${customer.name} <small>(${customer.category})</small></td>
                <td><input type="number" class="fish-input" data-customer="${customer.id}" data-fish="Mas" value="${fishData.Mas || ''}" min="0"></td>
                <td><input type="number" class="fish-input" data-customer="${customer.id}" data-fish="Nila" value="${fishData.Nila || ''}" min="0"></td>
                <td><input type="number" class="fish-input" data-customer="${customer.id}" data-fish="Mujair" value="${fishData.Mujair || ''}" min="0"></td>
                <td><input type="number" class="fish-input" data-customer="${customer.id}" data-fish="Lele Daging" value="${fishData['Lele Daging'] || ''}" min="0"></td>
                <td><input type="number" class="fish-input" data-customer="${customer.id}" data-fish="Lele BS" value="${fishData['Lele BS'] || ''}" min="0"></td>
                <td><input type="number" class="fish-input" data-customer="${customer.id}" data-fish="Bawal" value="${fishData.Bawal || ''}" min="0"></td>
                <td><input type="number" class="fish-input" data-customer="${customer.id}" data-fish="Ikan Mati" value="${fishData['Ikan Mati'] || ''}" min="0"></td>
                <td class="total-display" data-customer="${customer.id}">${total > 0 ? this.formatCurrency(total) : ''}</td>
                <td><input type="text" class="bayar-input" data-customer="${customer.id}" value="${bayar !== null ? this.formatNumberInput(bayar) : ''}" placeholder="Opsional"></td>
                <td><input type="text" class="kasbon-input" data-customer="${customer.id}" value="${currentKasBon > 0 ? this.formatNumberInput(currentKasBon) : ''}" placeholder="Ubah Manual"></td>
            `;

            tbody.appendChild(row);
        });

        // Add event listeners for inputs
        this.setupTableEventListeners();
    }

    setupTableEventListeners() {
        // Fish quantity inputs
        document.querySelectorAll('.fish-input').forEach(input => {
            input.addEventListener('input', (e) => {
                const customerId = parseInt(e.target.dataset.customer);
                const fishType = e.target.dataset.fish;
                const quantity = parseInt(e.target.value) || 0;
                
                this.updateFishQuantity(customerId, fishType, quantity);
            });
        });

        // HAPUS semua event listener pada bayar inputs dengan cara nuclear
        document.querySelectorAll('.bayar-input').forEach(input => {
            const parent = input.parentNode;
            const newInput = input.cloneNode(true);
            parent.replaceChild(newInput, input);
        });

        // Setup bayar inputs
        document.querySelectorAll('.bayar-input').forEach(input => {
            // Handle input formatting while typing
            input.addEventListener('input', (e) => {
                const cursorPosition = e.target.selectionStart;
                const oldLength = e.target.value.length;
                
                // Format the input value
                const rawValue = e.target.value.replace(/\D/g, '');
                const formattedValue = rawValue === '' ? '' : this.formatNumberInput(rawValue);
                
                e.target.value = formattedValue;
                
                // Adjust cursor position after formatting
                const newLength = formattedValue.length;
                const lengthDiff = newLength - oldLength;
                const newCursorPosition = Math.max(0, cursorPosition + lengthDiff);
                e.target.setSelectionRange(newCursorPosition, newCursorPosition);
            });

            input.addEventListener('blur', (e) => {
                const customerId = parseInt(e.target.dataset.customer);
                const bayarFormatted = e.target.value.trim();
                const bayar = this.parseNumberInput(bayarFormatted);
                
                console.log('BLUR event - Customer:', customerId, 'Formatted:', bayarFormatted, 'Parsed:', bayar);
                
                const existingKasBon = this.kasBonData[customerId] || 0;
                console.log('Kas bon lama:', existingKasBon);
                
                // Hitung kas bon baru berdasarkan transaksi hari ini
                let newKasBon = existingKasBon; // Mulai dari kas bon lama
                
                const transaction = this.dailyTransactions[customerId];
                if (transaction && transaction.total > 0 && bayar !== null) {
                    const todayDebt = transaction.total - bayar;
                    console.log('Hutang hari ini:', todayDebt);
                    
                    if (todayDebt > 0) {
                        // Kurang bayar: tambahkan ke kas bon lama
                        newKasBon = existingKasBon + todayDebt;
                    } else if (todayDebt < 0) {
                        // Lebih bayar: kurangi kas bon lama
                        const overpay = Math.abs(todayDebt);
                        newKasBon = Math.max(0, existingKasBon - overpay);
                    }
                    // Jika todayDebt = 0, newKasBon tetap = existingKasBon
                }
                
                // Update kas bon
                this.kasBonData[customerId] = newKasBon;
                console.log('Kas bon baru:', newKasBon);
                const kasBonInput = document.querySelector(`[data-customer="${customerId}"].kasbon-input`);
                if (kasBonInput) {
                    kasBonInput.value = newKasBon > 0 ? this.formatNumberInput(newKasBon) : '';
                }
                
                // Save to database
                window.fishDB.saveKasBon(customerId, this.kasBonData[customerId]);
                window.fishDB.saveDailyTransaction(
                    customerId,
                    this.currentDate,
                    transaction?.fishData || {},
                    transaction?.total || 0,
                    bayar
                );
                
                // Update display
                const kasBonDisplay = document.querySelector(`[data-customer="${customerId}"].kasbon-display`);
                if (kasBonDisplay) {
                    const kasBon = this.kasBonData[customerId] || 0;
                    kasBonDisplay.textContent = kasBon > 0 ? this.formatCurrency(kasBon) : '';
                    
                    // Update row style
                    const row = kasBonDisplay.closest('tr');
                    if (kasBon > 0) {
                        row.classList.add('has-kasbon');
                    } else {
                        row.classList.remove('has-kasbon');
                    }
                }
            });
            
            // Handle Enter key
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.target.blur(); // Trigger blur event
                }
                
                // Allow: backspace, delete, tab, escape, enter
                if ([46, 8, 9, 27, 13].indexOf(e.keyCode) !== -1 ||
                    // Allow: Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X
                    (e.keyCode === 65 && e.ctrlKey === true) ||
                    (e.keyCode === 67 && e.ctrlKey === true) ||
                    (e.keyCode === 86 && e.ctrlKey === true) ||
                    (e.keyCode === 88 && e.ctrlKey === true)) {
                    return;
                }
                // Ensure that it is a number and stop the keypress
                if ((e.shiftKey || (e.keyCode < 48 || e.keyCode > 57)) && (e.keyCode < 96 || e.keyCode > 105)) {
                    e.preventDefault();
                }
            });
        });

        document.querySelectorAll('.kasbon-input').forEach(input => {
            // Format saat mengetik
            input.addEventListener('input', (e) => {
                const cursorPosition = e.target.selectionStart;
                const oldLength = e.target.value.length;
                
                const rawValue = e.target.value.replace(/\D/g, '');
                const formattedValue = rawValue === '' ? '' : this.formatNumberInput(rawValue);
                
                e.target.value = formattedValue;
                
                const newLength = formattedValue.length;
                const lengthDiff = newLength - oldLength;
                const newCursorPosition = Math.max(0, cursorPosition + lengthDiff);
                e.target.setSelectionRange(newCursorPosition, newCursorPosition);
            });
        
            // Save saat blur
            input.addEventListener('blur', (e) => {
                const customerId = parseInt(e.target.dataset.customer);
                const kasBonFormatted = e.target.value.trim();
                const kasBon = this.parseNumberInput(kasBonFormatted) || 0;
                
                console.log('Manual kas bon update - Customer:', customerId, 'Value:', kasBon);
                
                // Update kas bon data
                this.kasBonData[customerId] = kasBon;
                
                // Save to database
                window.fishDB.saveKasBon(customerId, kasBon);
                
                // Update row style
                const row = e.target.closest('tr');
                if (kasBon > 0) {
                    row.classList.add('has-kasbon');
                } else {
                    row.classList.remove('has-kasbon');
                }
                
                console.log('Manual kas bon saved:', kasBon);
            });
        
            // Handle Enter key
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.target.blur();
                }
                
                // Allow: backspace, delete, tab, escape, enter
                if ([46, 8, 9, 27, 13].indexOf(e.keyCode) !== -1 ||
                    // Allow: Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X
                    (e.keyCode === 65 && e.ctrlKey === true) ||
                    (e.keyCode === 67 && e.ctrlKey === true) ||
                    (e.keyCode === 86 && e.ctrlKey === true) ||
                    (e.keyCode === 88 && e.ctrlKey === true)) {
                    return;
                }
                // Ensure that it is a number and stop the keypress
                if ((e.shiftKey || (e.keyCode < 48 || e.keyCode > 57)) && (e.keyCode < 96 || e.keyCode > 105)) {
                    e.preventDefault();
                }
            });
        });
    }

    calculateTotal(fishData) {
        let total = 0;
        Object.entries(fishData).forEach(([fishType, quantity]) => {
            if (quantity && this.fishPrices[fishType]) {
                total += quantity * this.fishPrices[fishType];
            }
        });
        return total;
    }

    async updateFishQuantity(customerId, fishType, quantity) {
        try {
            // Update daily transaction
            if (!this.dailyTransactions[customerId]) {
                this.dailyTransactions[customerId] = {
                    customerId,
                    date: this.currentDate,
                    fishData: {},
                    total: 0,
                    bayar: null
                };
            }

            // Remove fish type if quantity is 0
            if (quantity === 0) {
                delete this.dailyTransactions[customerId].fishData[fishType];
            } else {
                this.dailyTransactions[customerId].fishData[fishType] = quantity;
            }

            const total = this.calculateTotal(this.dailyTransactions[customerId].fishData);
            this.dailyTransactions[customerId].total = total;

            // Save to database
            await window.fishDB.saveDailyTransaction(
                customerId,
                this.currentDate,
                this.dailyTransactions[customerId].fishData,
                total,
                this.dailyTransactions[customerId].bayar
            );

            // Update display
            this.updateCustomerTotal(customerId, total);
            this.updateStockCalculations();

        } catch (error) {
            console.error('Error updating fish quantity:', error);
            this.showError('Gagal menyimpan data');
        }
    }

    updateCustomerTotal(customerId, total) {
        const totalDisplay = document.querySelector(`[data-customer="${customerId}"].total-display`);
        if (totalDisplay) {
            totalDisplay.textContent = total > 0 ? this.formatCurrency(total) : '';
        }
    }

    updateStockCalculations() {
        const fishTypes = ['Mas', 'Nila', 'Mujair', 'Lele Daging', 'Lele BS', 'Bawal'];
        
        // Calculate stock out from transactions (tetap sama)
        const stockOut = {};
        fishTypes.forEach(fishType => {
            stockOut[fishType] = 0;
        });

        Object.values(this.dailyTransactions).forEach(transaction => {
            Object.entries(transaction.fishData).forEach(([fishType, quantity]) => {
                if (fishTypes.includes(fishType) && quantity) {
                    stockOut[fishType] += quantity;
                }
            });
        });

        // Update stock data
        this.fishStock.stockOut = stockOut;

        // Calculate remaining stock: Masuk - Keluar - Mati
        const stockRemaining = {};
        fishTypes.forEach(fishType => {
            const stockIn = this.fishStock.stockIn?.[fishType] || 0;
            const stockOutQty = stockOut[fishType] || 0;
            const stockDead = this.fishStock.stockDead?.[fishType] || 0;
            stockRemaining[fishType] = Math.max(0, stockIn - stockOutQty - stockDead);
        });

        this.fishStock.stockRemaining = stockRemaining;

        // Save to database
        window.fishDB.saveFishStock(this.currentDate, this.fishStock);

        // Update hanya tampilan Stock Out dan Stock Remaining (jangan render ulang semua)
        this.updateStockDisplayOnly();
    }

    updateStockDisplayOnly() {
        const fishTypes = ['Mas', 'Nila', 'Mujair', 'Lele Daging', 'Lele BS', 'Bawal'];
        
        // Update Stock Out display
        fishTypes.forEach(fishType => {
            const stockOutElement = document.querySelector(`#stockOutGrid .stock-item.${fishType.toLowerCase().replace(' ', '-')} .stock-value`);
            if (stockOutElement) {
                stockOutElement.textContent = this.formatNumber(this.fishStock.stockOut?.[fishType] || 0);
            }
        });

        // Update Stock Remaining display  
        fishTypes.forEach(fishType => {
            const stockRemainingElement = document.querySelector(`#stockRemainingGrid .stock-item.${fishType.toLowerCase().replace(' ', '-')} .stock-value`);
            if (stockRemainingElement) {
                stockRemainingElement.textContent = this.formatNumber(this.fishStock.stockRemaining?.[fishType] || 0);
            }
        });
    }

    // Modal Methods
    openModal(modal) {
        modal.classList.add('show');
        modal.style.display = 'flex';
    }

    closeModal(modal) {
        modal.classList.remove('show');
        modal.style.display = 'none';
    }

    openPriceModal() {
        const modal = document.getElementById('priceModal');
        const modalBody = document.getElementById('priceModalBody');
        
        modalBody.innerHTML = '';
        Object.entries(this.fishPrices).forEach(([fishName, price]) => {
            const formGroup = document.createElement('div');
            formGroup.className = 'form-group';
            formGroup.innerHTML = `
                <label for="price-${fishName}">${fishName}:</label>
                <input type="number" id="price-${fishName}" value="${price}" min="0">
            `;
            modalBody.appendChild(formGroup);
        });

        this.openModal(modal);
    }

    openAddPriceModal() {
        // Implementation for adding new fish price
        const fishName = prompt('Masukkan nama ikan baru:');
        if (fishName && fishName.trim()) {
            const price = prompt('Masukkan harga per kg:');
            if (price && !isNaN(price)) {
                this.addNewFishPrice(fishName.trim(), parseInt(price));
            }
        }
    }

    async addNewFishPrice(fishName, price) {
        try {
            await window.fishDB.addFishPrice(fishName, price);
            this.fishPrices[fishName] = price;
            this.renderPrices();
            this.showSuccess(`Harga ${fishName} berhasil ditambahkan`);
        } catch (error) {
            console.error('Error adding fish price:', error);
            this.showError('Gagal menambahkan harga ikan');
        }
    }

    async savePriceChanges() {
        try {
            const modalBody = document.getElementById('priceModalBody');
            const inputs = modalBody.querySelectorAll('input[type="number"]');
            
            for (const input of inputs) {
                const fishName = input.id.replace('price-', '');
                const newPrice = parseInt(input.value) || 0;
                
                if (newPrice !== this.fishPrices[fishName]) {
                    await window.fishDB.updateFishPrice(fishName, newPrice);
                    this.fishPrices[fishName] = newPrice;
                }
            }

            this.renderPrices();
            this.renderCustomerTable(); // Re-render to update totals
            this.closeModal(document.getElementById('priceModal'));
            this.showSuccess('Harga berhasil diperbarui');

        } catch (error) {
            console.error('Error saving price changes:', error);
            this.showError('Gagal menyimpan perubahan harga');
        }
    }

    openCustomerModal(customer = null) {
        const modal = document.getElementById('customerModal');
        const title = document.getElementById('customerModalTitle');
        const nameInput = document.getElementById('customerName');
        const categorySelect = document.getElementById('customerCategory');
        const deleteBtn = document.getElementById('deleteCustomer');

        if (customer) {
            title.textContent = 'Edit Pelanggan';
            nameInput.value = customer.name;
            categorySelect.value = customer.category;
            modal.dataset.customerId = customer.id;
            deleteBtn.style.display = 'block'; // Show delete button for existing customers
        } else {
            title.textContent = 'Tambah Pelanggan';
            nameInput.value = '';
            categorySelect.value = 'pasar';
            delete modal.dataset.customerId;
            deleteBtn.style.display = 'none'; // Hide delete button for new customers
        }

        this.openModal(modal);
        nameInput.focus();
    }

    async saveCustomer() {
        try {
            const modal = document.getElementById('customerModal');
            const name = document.getElementById('customerName').value.trim();
            const category = document.getElementById('customerCategory').value;

            if (!name) {
                this.showError('Nama pelanggan harus diisi');
                return;
            }

            const customerId = modal.dataset.customerId;
            
            if (customerId) {
                // Update existing customer
                await window.fishDB.updateCustomer(parseInt(customerId), name, category);
                const customer = this.customers.find(c => c.id === parseInt(customerId));
                if (customer) {
                    customer.name = name;
                    customer.category = category;
                    
                    // Resort customers alphabetically after name change
                    this.customers.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
                    this.originalCustomerOrder = [...this.customers];
                }
                this.showSuccess('Pelanggan berhasil diperbarui');
            } else {
                // Add new customer
                await window.fishDB.addCustomer(name, category);
                await this.loadData(); // Reload to get new customer with ID and resort alphabetically
                this.showSuccess('Pelanggan berhasil ditambahkan');
            }

            this.renderCustomerTable();
            this.closeModal(modal);

        } catch (error) {
            console.error('Error saving customer:', error);
            this.showError('Gagal menyimpan pelanggan');
        }
    }

    async deleteCustomer() {
        try {
            const modal = document.getElementById('customerModal');
            const customerId = modal.dataset.customerId;
            
            if (!customerId) {
                this.showError('ID pelanggan tidak ditemukan');
                return;
            }

            const customer = this.customers.find(c => c.id === parseInt(customerId));
            if (!customer) {
                this.showError('Pelanggan tidak ditemukan');
                return;
            }

            // Confirm deletion
            const confirmMessage = `Apakah Anda yakin ingin menghapus pelanggan "${customer.name}"?\n\nPeringatan: Semua data transaksi pelanggan ini akan ikut terhapus!`;
            if (!confirm(confirmMessage)) {
                return;
            }

            // Check if customer has any transactions or kas bon
            const hasTransaction = this.dailyTransactions[parseInt(customerId)];
            const hasKasBon = this.kasBonData[parseInt(customerId)] > 0;
            
            if (hasTransaction || hasKasBon) {
                const warningMessage = `Pelanggan "${customer.name}" memiliki data transaksi atau kas bon. Menghapus pelanggan akan menghapus semua data terkait.\n\nLanjutkan hapus?`;
                if (!confirm(warningMessage)) {
                    return;
                }
            }

            // Delete from database
            await window.fishDB.deleteCustomer(parseInt(customerId));
            
            // Remove from local data
            this.customers = this.customers.filter(c => c.id !== parseInt(customerId));
            this.originalCustomerOrder = this.originalCustomerOrder.filter(c => c.id !== parseInt(customerId));
            // No need to resort since we're just removing, alphabetical order is maintained
            
            // Clean up related data
            delete this.dailyTransactions[parseInt(customerId)];
            delete this.kasBonData[parseInt(customerId)];

            // Re-render table
            this.renderCustomerTable();
            this.updateStockCalculations();
            
            this.closeModal(modal);
            this.showSuccess('Pelanggan berhasil dihapus');

        } catch (error) {
            console.error('Error deleting customer:', error);
            this.showError('Gagal menghapus pelanggan');
        }
    }

    openEditCustomerModal() {
        // Show list of customers to edit using the existing search field structure
        const searchField = document.getElementById('searchCustomerField');
        searchField.focus();
        searchField.placeholder = 'Ketik nama untuk edit, kemudian klik nama pelanggan...';
        
        // Add temporary click handlers to customer rows for editing
        document.querySelectorAll('.customer-table tbody tr').forEach(row => {
            row.style.cursor = 'pointer';
            row.title = 'Klik untuk edit pelanggan ini';
            
            row.onclick = () => {
                // Get customer ID from row
                const customerInput = row.querySelector('[data-customer]');
                if (customerInput) {
                    const customerId = parseInt(customerInput.dataset.customer);
                    const customer = this.customers.find(c => c.id === customerId);
                    if (customer) {
                        this.openCustomerModal(customer);
                        
                        // Reset search field and remove temporary handlers
                        searchField.placeholder = 'Cari nama langganan...';
                        this.resetEditMode();
                    }
                }
            };
        });

        this.showSuccess('Klik pada nama pelanggan yang ingin diedit');
    }

    resetEditMode() {
        // Remove temporary click handlers and styles
        document.querySelectorAll('.customer-table tbody tr').forEach(row => {
            row.onclick = null;
            row.style.cursor = '';
            row.title = '';
        });
    }

    openCalculatorModal() {
        const modal = document.getElementById('calculatorModal');
        this.openModal(modal);
        this.resetCalculator();
        this.setupCalculatorDragging();
    }

    setupCalculatorDragging() {
        const modal = document.getElementById('calculatorModal');
        const modalContent = document.getElementById('calculatorModalContent');
        const header = document.getElementById('calculatorHeader');
        
        let isDragging = false;
        let currentX, currentY, initialX, initialY;
        let xOffset = 0, yOffset = 0;

        header.addEventListener('mousedown', dragStart);
        document.addEventListener('mousemove', drag);
        document.addEventListener('mouseup', dragEnd);

        function dragStart(e) {
            if (e.target.closest('.close') || e.target.closest('.minimize-btn')) return;
            
            initialX = e.clientX - xOffset;
            initialY = e.clientY - yOffset;

            if (e.target === header || header.contains(e.target)) {
                isDragging = true;
                modal.style.cursor = 'grabbing';
            }
        }

        function drag(e) {
            if (isDragging) {
                e.preventDefault();
                currentX = e.clientX - initialX;
                currentY = e.clientY - initialY;

                xOffset = currentX;
                yOffset = currentY;

                modalContent.style.transform = `translate(${currentX}px, ${currentY}px)`;
                modalContent.style.position = 'relative';
            }
        }

        function dragEnd() {
            isDragging = false;
            modal.style.cursor = 'default';
        }

        // Minimize functionality
        document.getElementById('minimizeCalculator').addEventListener('click', () => {
            modal.classList.toggle('minimized');
        });
    }

    resetCalculator() {
        document.getElementById('calculatorDisplay').value = '';
        document.getElementById('calculatorHistory').textContent = '';
        
        // Reset active operator styling
        document.querySelectorAll('.calc-operator').forEach(btn => {
            btn.classList.remove('active');
        });
    }

    setupCalculator() {
        let currentInput = '';
        let operator = '';
        let previousInput = '';
        let justCalculated = false; // Flag untuk tracking hasil perhitungan
        let waitingForOperand = false;

        const display = document.getElementById('calculatorDisplay');
        const history = document.getElementById('calculatorHistory');

        function updateDisplay(value) {
            display.value = value || '0';
        }

        function updateHistory(text) {
            history.textContent = text;
        }

        function clearActiveOperator() {
            document.querySelectorAll('.calc-operator').forEach(btn => {
                btn.classList.remove('active');
            });
        }

        function setActiveOperator(operatorText) {
            clearActiveOperator();
            const operatorButtons = document.querySelectorAll('.calc-operator');
            operatorButtons.forEach(btn => {
                if (btn.textContent === operatorText) {
                    btn.classList.add('active');
                }
            });
        }

        function formatNumber(num) {
            // Format number dengan pemisah ribuan untuk display
            if (num.toString().includes('.')) {
                return parseFloat(num).toLocaleString('id-ID', { maximumFractionDigits: 8 });
            }
            return parseInt(num).toLocaleString('id-ID');
        }

        document.querySelectorAll('.calc-btn').forEach(button => {
            button.addEventListener('click', () => {
                const value = button.textContent;

                if (button.classList.contains('calc-number')) {
                    if (justCalculated) {
                        // Jika baru selesai perhitungan, reset dan mulai input baru
                        currentInput = value;
                        updateDisplay(value);
                        updateHistory('');
                        justCalculated = false;
                        clearActiveOperator();
                    } else if (waitingForOperand) {
                        // Jika sedang menunggu operand baru setelah operator
                        currentInput = value;
                        updateDisplay(value);
                        waitingForOperand = false;
                    } else {
                        // Normal input - tambahkan digit
                        if (display.value === '0' && value !== '.') {
                            currentInput = value;
                        } else {
                            currentInput = currentInput + value;
                        }
                        updateDisplay(currentInput);
                    }
                }
                else if (button.classList.contains('calc-operator')) {
                    const operatorSymbol = value === '×' ? '×' : value === '÷' ? '÷' : value;
                    const calculationOperator = value === '×' ? '*' : value === '÷' ? '/' : value;

                    if (currentInput === '' && previousInput === '') {
                        return; // Tidak bisa operator tanpa angka
                    }

                    if (previousInput && currentInput && operator && !waitingForOperand) {
                        // Ada perhitungan yang pending, hitung dulu
                        const result = this.calculateResult(parseFloat(previousInput), parseFloat(currentInput), operator);
                        const formattedResult = formatNumber(result);
                        updateDisplay(formattedResult);
                        updateHistory(`${formatNumber(previousInput)} ${operator === '*' ? '×' : operator === '/' ? '÷' : operator} ${formatNumber(currentInput)} = ${formattedResult}`);
                        currentInput = result.toString();
                    }
                    
                    if (currentInput) {
                        previousInput = currentInput;
                        operator = calculationOperator;
                        
                        // Update history to show ongoing calculation
                        updateHistory(`${formatNumber(previousInput)} ${operatorSymbol}`);
                        
                        // Set active operator styling
                        setActiveOperator(operatorSymbol);
                        
                        waitingForOperand = true;
                        justCalculated = false;
                    }
                }
                else if (button.classList.contains('calc-equals')) {
                    if (currentInput && previousInput && operator) {
                        const result = this.calculateResult(parseFloat(previousInput), parseFloat(currentInput), operator);
                        const operatorSymbol = operator === '*' ? '×' : operator === '/' ? '÷' : operator;
                        const formattedResult = formatNumber(result);
                        
                        updateDisplay(formattedResult);
                        updateHistory(`${formatNumber(previousInput)} ${operatorSymbol} ${formatNumber(currentInput)} = ${formattedResult}`);
                        
                        currentInput = result.toString();
                        previousInput = '';
                        operator = '';
                        justCalculated = true; // Set flag bahwa baru selesai perhitungan
                        waitingForOperand = false;
                        clearActiveOperator();
                    }
                }
                else if (button.classList.contains('calc-clear')) {
                    if (button.dataset.action === 'clear-entry') {
                        // CE - Clear Entry (hanya clear input saat ini)
                        updateDisplay('0');
                        currentInput = '';
                        if (!previousInput) {
                            updateHistory('');
                        }
                    } else {
                        // C - Clear All
                        updateDisplay('0');
                        updateHistory('');
                        currentInput = '';
                        previousInput = '';
                        operator = '';
                        justCalculated = false;
                        waitingForOperand = false;
                        clearActiveOperator();
                    }
                }
                else if (button.classList.contains('calc-backspace')) {
                    if (justCalculated) {
                        // Jika baru selesai perhitungan, backspace akan clear semua
                        updateDisplay('0');
                        updateHistory('');
                        currentInput = '';
                        previousInput = '';
                        operator = '';
                        justCalculated = false;
                        waitingForOperand = false;
                        clearActiveOperator();
                    } else if (currentInput && currentInput.length > 1) {
                        currentInput = currentInput.slice(0, -1);
                        updateDisplay(currentInput);
                    } else {
                        currentInput = '';
                        updateDisplay('0');
                    }
                }
            });
        });

        // Keyboard support
        document.addEventListener('keydown', (e) => {
            if (!document.getElementById('calculatorModal').classList.contains('show')) return;
            
            e.preventDefault();
            
            if (e.key >= '0' && e.key <= '9' || e.key === '.') {
                const numberBtn = Array.from(document.querySelectorAll('.calc-number')).find(btn => btn.textContent === e.key);
                if (numberBtn) numberBtn.click();
            } else if (e.key === '+' || e.key === '-') {
                const operatorBtn = Array.from(document.querySelectorAll('.calc-operator')).find(btn => btn.textContent === e.key);
                if (operatorBtn) operatorBtn.click();
            } else if (e.key === '*') {
                const operatorBtn = Array.from(document.querySelectorAll('.calc-operator')).find(btn => btn.textContent === '×');
                if (operatorBtn) operatorBtn.click();
            } else if (e.key === '/') {
                const operatorBtn = Array.from(document.querySelectorAll('.calc-operator')).find(btn => btn.textContent === '÷');
                if (operatorBtn) operatorBtn.click();
            } else if (e.key === 'Enter' || e.key === '=') {
                const equalsBtn = document.querySelector('.calc-equals');
                if (equalsBtn) equalsBtn.click();
            } else if (e.key === 'Escape' || e.key === 'c' || e.key === 'C') {
                const clearBtn = document.querySelector('.calc-clear');
                if (clearBtn) clearBtn.click();
            } else if (e.key === 'Backspace') {
                const backspaceBtn = document.querySelector('.calc-backspace');
                if (backspaceBtn) backspaceBtn.click();
            }
        });

        // Initialize display
        updateDisplay('0');
    }

    calculateResult(num1, num2, operator) {
        switch (operator) {
            case '+': return num1 + num2;
            case '-': return num1 - num2;
            case '*': return num1 * num2;
            case '/': return num2 !== 0 ? num1 / num2 : 0;
            default: return num2;
        }
    }

    async downloadReport() {
        try {
            // Create report data
            const reportData = {
                date: this.currentDate,
                dateDisplay: this.formatDateDisplay(this.currentDate),
                customers: [],
                summary: {
                    totalRevenue: 0,
                    totalKasBon: 0,
                    totalCustomers: this.customers.length
                },
                fishStock: this.fishStock,
                fishPrices: this.fishPrices
            };

            // Process customer data
            this.customers.forEach(customer => {
                const transaction = this.dailyTransactions[customer.id];
                const existingKasBon = this.kasBonData[customer.id] || 0;
                
                if (transaction && Object.keys(transaction.fishData).length > 0) {
                    const total = this.calculateTotal(transaction.fishData);
                    const bayar = transaction.bayar !== null ? transaction.bayar : total; // Jika tidak ada bayar, anggap cash
                    
                    // Hitung kas bon dengan logika yang benar
                    let finalKasBon = existingKasBon;
                    if (transaction.bayar !== null) {
                        const selisih = total - transaction.bayar;
                        if (selisih > 0) {
                            finalKasBon = existingKasBon + selisih;
                        } else if (selisih < 0) {
                            finalKasBon = Math.max(0, existingKasBon + selisih);
                        }
                    }
                    
                    reportData.customers.push({
                        name: customer.name,
                        category: customer.category,
                        fishData: transaction.fishData,
                        total: total,
                        bayar: bayar,
                        kasBon: finalKasBon
                    });

                    reportData.summary.totalRevenue += bayar;
                    reportData.summary.totalKasBon += finalKasBon;
                }
            });

            // Generate HTML report
            const reportHTML = this.generateReportHTML(reportData);
            
            // Create and download file
            const blob = new Blob([reportHTML], { type: 'text/html' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Laporan_Ikan_${this.currentDate}.html`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            this.showSuccess('Laporan berhasil didownload');

        } catch (error) {
            console.error('Error downloading report:', error);
            this.showError('Gagal mendownload laporan');
        }
    }

    generateReportHTML(data) {
        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Laporan Ikan - ${data.dateDisplay}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { text-align: center; margin-bottom: 30px; }
        .summary { background: #f8f9fa; padding: 15px; margin-bottom: 20px; border-radius: 5px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: center; }
        th { background: #f8f9fa; }
        .currency { text-align: right; }
        .number { text-align: right; }
        .section { margin-bottom: 30px; }
        @media print { body { margin: 0; } }
    </style>
</head>
<body>
    <div class="header">
        <h1>LAPORAN PENJUALAN IKAN</h1>
        <h2>${data.dateDisplay}</h2>
    </div>

    <div class="summary">
        <h3>Ringkasan</h3>
        <p><strong>Total Pendapatan:</strong> ${this.formatCurrency(data.summary.totalRevenue)}</p>
        <p><strong>Total Kas Bon:</strong> ${this.formatCurrency(data.summary.totalKasBon)}</p>
        <p><strong>Jumlah Pelanggan:</strong> ${this.formatNumber(data.summary.totalCustomers)}</p>
    </div>

    <div class="section">
        <h3>Detail Penjualan</h3>
        <table>
            <thead>
                <tr>
                    <th>Nama Pelanggan</th>
                    <th>Kategori</th>
                    <th>Mas</th>
                    <th>Nila</th>
                    <th>Mujair</th>
                    <th>Lele Daging</th>
                    <th>Lele BS</th>
                    <th>Bawal</th>
                    <th>Ikan Mati</th>
                    <th>Total</th>
                    <th>Bayar</th>
                    <th>Kas Bon</th>
                </tr>
            </thead>
            <tbody>
                ${data.customers.map(customer => `
                    <tr>
                        <td>${customer.name}</td>
                        <td>${customer.category}</td>
                        <td class="number">${this.formatNumber(customer.fishData.Mas || 0)}</td>
                        <td class="number">${this.formatNumber(customer.fishData.Nila || 0)}</td>
                        <td class="number">${this.formatNumber(customer.fishData.Mujair || 0)}</td>
                        <td class="number">${this.formatNumber(customer.fishData['Lele Daging'] || 0)}</td>
                        <td class="number">${this.formatNumber(customer.fishData['Lele BS'] || 0)}</td>
                        <td class="number">${this.formatNumber(customer.fishData.Bawal || 0)}</td>
                        <td class="number">${this.formatNumber(customer.fishData['Ikan Mati'] || 0)}</td>
                        <td class="currency">${this.formatCurrency(customer.total)}</td>
                        <td class="currency">${this.formatCurrency(customer.bayar)}</td>
                        <td class="currency">${customer.kasBon > 0 ? this.formatCurrency(customer.kasBon) : '-'}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    </div>

    <div class="section">
        <h3>Harga Ikan</h3>
        <table style="width: 50%;">
            <thead>
                <tr><th>Jenis Ikan</th><th>Harga</th></tr>
            </thead>
            <tbody>
                ${Object.entries(data.fishPrices).map(([fish, price]) => `
                    <tr>
                        <td>${fish}</td>
                        <td class="currency">${this.formatCurrency(price)}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    </div>

    <div class="section">
        <h3>Stok Ikan</h3>
        <table style="width: 80%;">
            <thead>
                <tr>
                    <th>Jenis Ikan</th>
                    <th>Masuk</th>
                    <th>Keluar</th>
                    <th>Mati</th>
                    <th>Sisa</th>
                </tr>
            </thead>
            <tbody>
                ${['Mas', 'Nila', 'Mujair', 'Lele Daging', 'Lele BS', 'Bawal'].map(fish => `
                    <tr>
                        <td>${fish}</td>
                        <td class="number">${this.formatNumber(data.fishStock.stockIn?.[fish] || 0)}</td>
                        <td class="number">${this.formatNumber(data.fishStock.stockOut?.[fish] || 0)}</td>
                        <td class="number">${this.formatNumber(data.fishStock.stockDead?.[fish] || 0)}</td>
                        <td class="number">${this.formatNumber(data.fishStock.stockRemaining?.[fish] || 0)}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    </div>
</body>
</html>`;
    }

    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    showNotification(message, type) {
        // Create notification element
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 5px;
            color: white;
            font-weight: bold;
            z-index: 10000;
            animation: slideIn 0.3s ease-out;
            ${type === 'success' ? 'background: #4caf50;' : 'background: #f44336;'}
        `;
        notification.textContent = message;

        document.body.appendChild(notification);

        // Auto remove after 3 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease-out';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }

    // Debug method untuk memeriksa semua kas bon
    async debugAllKasBon() {
        console.log('=== DEBUG ALL KAS BON ===');
        console.log('Kas bon data in memory:', this.kasBonData);
        
        // Check database
        const allKasBon = await window.fishDB.getAllKasBon();
        console.log('Kas bon data in database:', allKasBon);
        
        // Check transactions
        console.log('Daily transactions:', this.dailyTransactions);
        
        console.log('=== END DEBUG ALL KAS BON ===');
    }

    // Method untuk reset kas bon customer tertentu (untuk debugging)
    async resetCustomerKasBon(customerId) {
        console.log(`Resetting kas bon for customer ${customerId}`);
        this.kasBonData[customerId] = 0;
        await window.fishDB.saveKasBon(customerId, 0);
        this.renderCustomerTable();
        console.log('Kas bon reset complete');
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.fishApp = new FishApp();
});

// Add CSS animations for notifications
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(style);
