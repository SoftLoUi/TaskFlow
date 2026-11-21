
const DB_NAME = "TaskFlowDB";
const DB_VERSION = 1;

let db;

function openDatabase() {
    return new Promise((resolve, reject) => {

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const database = event.target.result;

            if (!database.objectStoreNames.contains("activities")) {
                database.createObjectStore("activities", {
                    keyPath: "id",
                    autoIncrement: true
                });
            }

            if (!database.objectStoreNames.contains("pendingSync")) {
                database.createObjectStore("pendingSync", {
                    keyPath: "id",
                    autoIncrement: true
                });
            }
        };

        request.onsuccess = () => {
            db = request.result;
            resolve(db);
        };

        request.onerror = () => {
            reject(request.error);
        };

    });
}

function getStore(storeName, mode = "readonly") {
    const transaction = db.transaction(storeName, mode);
    return transaction.objectStore(storeName);
}

function addActivity(activity) {
    return new Promise((resolve, reject) => {
        const request = getStore("activities", "readwrite").add(activity);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function getActivities() {
    return new Promise((resolve, reject) => {
        const request = getStore("activities").getAll();

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function updateActivity(activity) {
    return new Promise((resolve, reject) => {
        const request = getStore("activities", "readwrite").put(activity);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function deleteActivity(id) {
    return new Promise((resolve, reject) => {
        const request = getStore("activities", "readwrite").delete(Number(id));

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

function addPendingSync(operation) {
    return new Promise((resolve, reject) => {
        const request = getStore("pendingSync", "readwrite").add(operation);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function getPendingSync() {
    return new Promise((resolve, reject) => {
        const request = getStore("pendingSync").getAll();

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function deletePendingSync(id) {
    return new Promise((resolve, reject) => {
        const request = getStore("pendingSync", "readwrite").delete(Number(id));

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}
