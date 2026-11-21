const API_ENDPOINT = "";

let syncing = false;

async function registerBackgroundSync() {

    if (!("serviceWorker" in navigator)) return;

    try {
        const registration = await navigator.serviceWorker.ready;

        if ("sync" in registration) {
            await registration.sync.register("taskflow-sync");
        }

    } catch (error) {
        console.log("Background Sync no disponible:", error);
    }
}

async function synchronizeData() {

    if (!navigator.onLine || syncing) return;

    const pending = await getPendingSync();

    if (pending.length === 0) {
        updateSyncStatus("● Información actualizada");
        return;
    }

    // Sin endpoint no existe un servidor remoto al cual enviar datos.
    if (!API_ENDPOINT) {
        updateSyncStatus(
            `● ${pending.length} cambio(s) guardados localmente`
        );
        return;
    }

    syncing = true;
    updateSyncStatus("● Sincronizando...");

    try {

        for (const operation of pending) {

            const response = await fetch(API_ENDPOINT, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(operation)
            });

            if (!response.ok) {
                throw new Error("Error al sincronizar con el servidor.");
            }

            await deletePendingSync(operation.id);
        }

        updateSyncStatus("● Sincronización completada");
        showToast("Los cambios se sincronizaron correctamente.");

    } catch (error) {

        console.error("Error de sincronización:", error);

        updateSyncStatus("● Sincronización pendiente");

    } finally {
        syncing = false;
    }
}

function updateSyncStatus(message) {
    const element = document.getElementById("syncStatus");

    if (element) {
        element.textContent = message;
    }
}

window.addEventListener("online", () => {

    updateConnectionStatus();

    showToast("¡Conexión recuperada!");

    synchronizeData();

});

window.addEventListener("offline", () => {

    updateConnectionStatus();

    updateSyncStatus("● Sin conexión. Cambios guardados localmente");

    showToast("Modo sin conexión activado.");

});
