// Database Management for Fish Business App
class FishDatabase {
    constructor() {
        this.dbName = 'fishBusinessDB';
        this.version = 1;
        this.db = null;
        this.init();
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Store untuk harga ikan
                if (!db.objectStoreNames.contains('fishPrices')) {
                    const pricesStore = db.createObjectStore('fishPrices', { keyPath: 'name' });
                    // Initialize default prices
                    const defaultPrices = [
                        { name: 'Mas', price: 32000 },
                        { name: 'Mujair', price: 34000 },
                        { name: 'Lele BS', price: 19000 },
                        { name: 'Bawal', price: 28000 },
                        { name: 'Nila', price: 35000 },
                        { name: 'Lele Daging', price: 25000 },
                        { name: 'Ikan Mati', price: 15000 }
                    ];
                }
                
                // Store untuk pelanggan
                if (!db.objectStoreNames.contains('customers')) {
                    const customersStore = db.createObjectStore('customers', { keyPath: 'id', autoIncrement: true });
                    customersStore.createIndex('name', 'name', { unique: false });
                    customersStore.createIndex('category', 'category', { unique: false });
                }
                
                // Store untuk transaksi harian
                if (!db.objectStoreNames.contains('dailyTransactions')) {
                    const transactionsStore = db.createObjectStore('dailyTransactions', { keyPath: 'id', autoIncrement: true });
                    transactionsStore.createIndex('date', 'date', { unique: false });
                    transactionsStore.createIndex('customerId', 'customerId', { unique: false });
                }
                
                // Store untuk stok ikan
                if (!db.objectStoreNames.contains('fishStock')) {
                    const stockStore = db.createObjectStore('fishStock', { keyPath: 'date' });
                }
                
                // Store untuk kas bon
                if (!db.objectStoreNames.contains('kasBon')) {
                    const kasBonStore = db.createObjectStore('kasBon', { keyPath: 'customerId' });
                }
            };
        });
    }

    // Fish Prices Methods
    async getFishPrices() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['fishPrices'], 'readonly');
            const store = transaction.objectStore('fishPrices');
            const request = store.getAll();
            
            request.onsuccess = () => {
                const prices = request.result;
                if (prices.length === 0) {
                    // Initialize with default prices
                    this.initializeDefaultPrices().then(() => {
                        resolve(this.getDefaultPrices());
                    });
                } else {
                    resolve(prices);
                }
            };
            request.onerror = () => reject(request.error);
        });
    }

    getDefaultPrices() {
        return [
            { name: 'Mas', price: 32000 },
            { name: 'Mujair', price: 34000 },
            { name: 'Lele BS', price: 19000 },
            { name: 'Bawal', price: 28000 },
            { name: 'Nila', price: 35000 },
            { name: 'Lele Daging', price: 25000 },
            { name: 'Ikan Mati', price: 15000 }
        ];
    }

    async initializeDefaultPrices() {
        const defaultPrices = this.getDefaultPrices();
        const transaction = this.db.transaction(['fishPrices'], 'readwrite');
        const store = transaction.objectStore('fishPrices');
        
        for (const price of defaultPrices) {
            store.add(price);
        }
        
        return new Promise((resolve, reject) => {
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
        });
    }

    async updateFishPrice(name, price) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['fishPrices'], 'readwrite');
            const store = transaction.objectStore('fishPrices');
            const request = store.put({ name, price });
            
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async addFishPrice(name, price) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['fishPrices'], 'readwrite');
            const store = transaction.objectStore('fishPrices');
            const request = store.add({ name, price });
            
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    // Customer Methods
    async getCustomers() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['customers'], 'readonly');
            const store = transaction.objectStore('customers');
            const request = store.getAll();
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async addCustomer(name, category) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['customers'], 'readwrite');
            const store = transaction.objectStore('customers');
            const request = store.add({ name, category, createdAt: new Date() });
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async updateCustomer(id, name, category) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['customers'], 'readwrite');
            const store = transaction.objectStore('customers');
            const getRequest = store.get(id);
            
            getRequest.onsuccess = () => {
                const customer = getRequest.result;
                if (customer) {
                    customer.name = name;
                    customer.category = category;
                    const updateRequest = store.put(customer);
                    updateRequest.onsuccess = () => resolve();
                    updateRequest.onerror = () => reject(updateRequest.error);
                } else {
                    reject(new Error('Customer not found'));
                }
            };
            getRequest.onerror = () => reject(getRequest.error);
        });
    }

    async deleteCustomer(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['customers'], 'readwrite');
            const store = transaction.objectStore('customers');
            const request = store.delete(id);
            
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async searchCustomers(searchTerm) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['customers'], 'readonly');
            const store = transaction.objectStore('customers');
            const request = store.getAll();
            
            request.onsuccess = () => {
                const customers = request.result;
                const filtered = customers.filter(customer => 
                    customer.name.toLowerCase().includes(searchTerm.toLowerCase())
                );
                resolve(filtered);
            };
            request.onerror = () => reject(request.error);
        });
    }

    // Daily Transactions Methods
    async getDailyTransaction(date, customerId) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['dailyTransactions'], 'readonly');
            const store = transaction.objectStore('dailyTransactions');
            const index = store.index('date');
            const request = index.getAll(date);
            
            request.onsuccess = () => {
                const transactions = request.result;
                const customerTransaction = transactions.find(t => t.customerId === customerId);
                resolve(customerTransaction || null);
            };
            request.onerror = () => reject(request.error);
        });
    }

    async saveDailyTransaction(customerId, date, fishData, total, bayar = null) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['dailyTransactions'], 'readwrite');
            const store = transaction.objectStore('dailyTransactions');
            
            const transactionData = {
                customerId,
                date,
                fishData,
                total,
                bayar,
                createdAt: new Date()
            };

            // Check if transaction exists for this customer and date
            const index = store.index('date');
            const getRequest = index.getAll(date);
            
            getRequest.onsuccess = () => {
                const existingTransactions = getRequest.result;
                const existingTransaction = existingTransactions.find(t => t.customerId === customerId);
                
                if (existingTransaction) {
                    // Update existing transaction
                    transactionData.id = existingTransaction.id;
                    const updateRequest = store.put(transactionData);
                    updateRequest.onsuccess = () => resolve();
                    updateRequest.onerror = () => reject(updateRequest.error);
                } else {
                    // Add new transaction
                    const addRequest = store.add(transactionData);
                    addRequest.onsuccess = () => resolve();
                    addRequest.onerror = () => reject(addRequest.error);
                }
            };
            getRequest.onerror = () => reject(getRequest.error);
        });
    }

    async getDailyTransactions(date) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['dailyTransactions'], 'readonly');
            const store = transaction.objectStore('dailyTransactions');
            const index = store.index('date');
            const request = index.getAll(date);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // Fish Stock Methods
    async getFishStock(date) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['fishStock'], 'readonly');
            const store = transaction.objectStore('fishStock');
            const request = store.get(date);
            
            request.onsuccess = () => {
                const stock = request.result;
                if (!stock) {
                    // Return default empty stock
                    resolve({
                        date,
                        stockIn: { Mas: 0, Nila: 0, Mujair: 0, 'Lele Daging': 0, 'Lele BS': 0, Bawal: 0 },
                        stockOut: { Mas: 0, Nila: 0, Mujair: 0, 'Lele Daging': 0, 'Lele BS': 0, Bawal: 0 },
                        stockDead: { Mas: 0, Nila: 0, Mujair: 0, 'Lele Daging': 0, 'Lele BS': 0, Bawal: 0 },
                        stockRemaining: { Mas: 0, Nila: 0, Mujair: 0, 'Lele Daging': 0, 'Lele BS': 0, Bawal: 0 }
                    });
                } else {
                    resolve(stock);
                }
            };
            request.onerror = () => reject(request.error);
        });
    }

    async saveFishStock(date, stockData) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['fishStock'], 'readwrite');
            const store = transaction.objectStore('fishStock');
            const request = store.put({ date, ...stockData });
            
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    // Kas Bon Methods - Diperbaiki
    async getKasBon(customerId) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['kasBon'], 'readonly');
            const store = transaction.objectStore('kasBon');
            const request = store.get(customerId);
            
            request.onsuccess = () => {
                const kasBon = request.result;
                resolve(kasBon ? kasBon.amount : 0);
            };
            request.onerror = () => reject(request.error);
        });
    }

    async saveKasBon(customerId, amount) {
        return new Promise((resolve, reject) => {
            console.log(`=== SAVE KAS BON to DB ===`);
            console.log('Customer ID:', customerId);
            console.log('Amount to save:', amount);
            
            const transaction = this.db.transaction(['kasBon'], 'readwrite');
            const store = transaction.objectStore('kasBon');
            
            if (amount === 0) {
                // Delete kas bon if amount is 0
                console.log('Deleting kas bon (amount = 0)');
                const request = store.delete(customerId);
                request.onsuccess = () => {
                    console.log('Kas bon deleted successfully');
                    resolve();
                };
                request.onerror = () => {
                    console.error('Error deleting kas bon:', request.error);
                    reject(request.error);
                };
            } else {
                // Save or update kas bon
                console.log('Saving/updating kas bon');
                const kasBonData = { 
                    customerId, 
                    amount, 
                    updatedAt: new Date() 
                };
                const request = store.put(kasBonData);
                request.onsuccess = () => {
                    console.log('Kas bon saved successfully');
                    resolve();
                };
                request.onerror = () => {
                    console.error('Error saving kas bon:', request.error);
                    reject(request.error);
                };
            }
        });
    }

    async getAllKasBon() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['kasBon'], 'readonly');
            const store = transaction.objectStore('kasBon');
            const request = store.getAll();
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // Clear daily data (except kas bon)
    async clearDailyData(date) {
        return new Promise(async (resolve, reject) => {
            try {
                // Clear daily transactions
                const transactionStore = this.db.transaction(['dailyTransactions'], 'readwrite').objectStore('dailyTransactions');
                const index = transactionStore.index('date');
                const request = index.getAll(date);
                
                request.onsuccess = () => {
                    const transactions = request.result;
                    transactions.forEach(transaction => {
                        transactionStore.delete(transaction.id);
                    });
                };

                // Reset fish stock for the day
                await this.saveFishStock(date, {
                    stockIn: { Mas: 0, Nila: 0, Mujair: 0, 'Lele Daging': 0, 'Lele BS': 0, Bawal: 0 },
                    stockOut: { Mas: 0, Nila: 0, Mujair: 0, 'Lele Daging': 0, 'Lele BS': 0, Bawal: 0 },
                    stockDead: { Mas: 0, Nila: 0, Mujair: 0, 'Lele Daging': 0, 'Lele BS': 0, Bawal: 0 },
                    stockRemaining: { Mas: 0, Nila: 0, Mujair: 0, 'Lele Daging': 0, 'Lele BS': 0, Bawal: 0 }
                });

                resolve();
            } catch (error) {
                reject(error);
            }
        });
    }

    // Debug method untuk memeriksa kas bon
    async debugKasBon(customerId) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['kasBon'], 'readonly');
            const store = transaction.objectStore('kasBon');
            const request = store.get(customerId);
            
            request.onsuccess = () => {
                const result = request.result;
                console.log('=== DEBUG KAS BON from DB ===');
                console.log('Customer ID:', customerId);
                console.log('Raw data from DB:', result);
                console.log('Amount:', result ? result.amount : 0);
                console.log('=== END DEBUG ===');
                resolve(result);
            };
            request.onerror = () => reject(request.error);
        });
    }
}

// Global database instance
window.fishDB = new FishDatabase();