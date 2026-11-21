
let currentFilter = "all";

const taskModal = document.getElementById("taskModal");
const taskForm = document.getElementById("taskForm");
const taskList = document.getElementById("taskList");

document.addEventListener("DOMContentLoaded", async () => {

    try {

        await openDatabase();

        setCurrentDate();
        updateConnectionStatus();
        await renderTasks();
        registerServiceWorker();
        checkReminders();
        setInterval(checkReminders, 30000);

        document.addEventListener("visibilitychange", () => {
            if (!document.hidden) {
                checkReminders();
            }
        });

        if (navigator.onLine) {
            synchronizeData();
        }

    } catch (error) {

        console.error("Error al iniciar TaskFlow:", error);

        showToast("No se pudo iniciar la base de datos.");

    }

});

function setCurrentDate() {

    const date = new Date();

    document.getElementById("currentDate").textContent =
        date.toLocaleDateString("es-MX", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric"
        });
}

function updateConnectionStatus() {

    const status = document.getElementById("connectionStatus");

    if (navigator.onLine) {

        status.textContent = "● En línea";
        status.classList.remove("offline");

    } else {

        status.textContent = "● Sin conexión";
        status.classList.add("offline");

    }
}

async function registerServiceWorker() {

    if ("serviceWorker" in navigator) {

        try {

            const registration = await navigator.serviceWorker.register(
                "./sw.js"
            );

            console.log("Service Worker registrado:", registration.scope);

        } catch (error) {

            console.error("Error registrando Service Worker:", error);

        }

    }
}

document.getElementById("notificationBtn").addEventListener(
    "click",
    requestNotificationPermission
);

document.getElementById("addTaskBtn").addEventListener("click", () => {

    resetForm();

    document.getElementById("modalTitle").textContent = "Nueva actividad";

    taskModal.classList.remove("hidden");

});

function closeModal() {
    taskModal.classList.add("hidden");
}

document.getElementById("closeModalBtn").addEventListener(
    "click",
    closeModal
);

document.getElementById("cancelBtn").addEventListener(
    "click",
    closeModal
);

taskModal.addEventListener("click", (event) => {

    if (event.target === taskModal) {
        closeModal();
    }

});

function resetForm() {

    taskForm.reset();

    document.getElementById("taskId").value = "";

    document.getElementById("taskPriority").value = "medium";

    document.getElementById("taskReminder").checked = true;

}
taskForm.addEventListener("submit", async (event) => {

    event.preventDefault();

    const id = document.getElementById("taskId").value;

    const activity = {

        title: document.getElementById("taskTitle").value.trim(),

        description: document.getElementById("taskDescription").value.trim(),

        date: document.getElementById("taskDate").value,

        time: document.getElementById("taskTime").value,

        priority: document.getElementById("taskPriority").value,

        reminder: document.getElementById("taskReminder").checked,

        completed: false,

        notified: false,

        updatedAt: new Date().toISOString()

    };

    if (!activity.title || !activity.date || !activity.time) {
        showToast("Completa los campos obligatorios.");
        return;
    }

    try {

        if (id) {

            const existing = (await getActivities()).find(
                task => task.id === Number(id)
            );

            if (!existing) {
                showToast("La actividad ya no existe.");
                return;
            }

            activity.id = Number(id);

            activity.completed = existing.completed;

            await updateActivity(activity);

            await addPendingSync({
                action: "update",
                data: activity,
                createdAt: new Date().toISOString()
            });

            showToast("Actividad modificada correctamente.");

        } else {

            activity.createdAt = new Date().toISOString();

            const newId = await addActivity(activity);

            activity.id = newId;

            await addPendingSync({
                action: "create",
                data: activity,
                createdAt: new Date().toISOString()
            });

            showToast("Actividad registrada correctamente.");

        }

        await registerBackgroundSync();

        closeModal();

        await renderTasks();

        if (navigator.onLine) {
            synchronizeData();
        }

    } catch (error) {

        console.error(error);

        showToast("Ocurrió un error al guardar.");

    }

});

async function renderTasks() {

    const activities = await getActivities();

    let filtered = activities;

    if (currentFilter === "pending") {
        filtered = activities.filter(task => !task.completed);
    }

    if (currentFilter === "completed") {
        filtered = activities.filter(task => task.completed);
    }

    filtered.sort((a, b) => {

        const dateA = new Date(`${a.date}T${a.time}`);
        const dateB = new Date(`${b.date}T${b.time}`);

        return dateA - dateB;

    });

    document.getElementById("totalTasks").textContent =
        activities.length;

    document.getElementById("pendingTasks").textContent =
        activities.filter(task => !task.completed).length;

    document.getElementById("completedTasks").textContent =
        activities.filter(task => task.completed).length;

    if (filtered.length === 0) {

        taskList.innerHTML = `
            <div class="empty-state">
                <h3>No hay actividades</h3>
                <p>No se encontraron actividades en esta categoría.</p>
            </div>
        `;

        return;
    }

    taskList.innerHTML = filtered.map(task => {

        const priorityNames = {
            high: "Alta",
            medium: "Media",
            low: "Baja"
        };

        const date = new Date(
            `${task.date}T${task.time}:00`
        );

        const formattedDate = date.toLocaleDateString("es-MX", {
            day: "numeric",
            month: "short",
            year: "numeric"
        });

        return `

            <article class="task-card ${task.completed ? "completed" : ""}">

                <div class="task-main">

                    <input
                        type="checkbox"
                        class="task-check"
                        data-action="toggle"
                        data-id="${task.id}"
                        ${task.completed ? "checked" : ""}
                        aria-label="Marcar actividad como completada"
                    >

                    <div class="task-details">

                        <h3 class="task-title">
                            ${escapeHTML(task.title)}
                        </h3>

                        <p class="task-description">
                            ${escapeHTML(task.description || "Sin descripción")}
                        </p>

                        <div class="task-meta">

                            <span>📅 ${formattedDate}</span>

                            <span>🕒 ${task.time}</span>

                            <span class="priority ${task.priority}">
                                ${priorityNames[task.priority]}
                            </span>

                            ${task.reminder ? "<span>Recordatorio</span>" : ""}

                        </div>

                    </div>

                </div>

                <div class="task-actions">

                    <button
                        class="action-btn"
                        data-action="edit"
                        data-id="${task.id}"
                        aria-label="Editar actividad"
                    >
                        ✎
                    </button>

                    <button
                        class="action-btn delete-btn"
                        data-action="delete"
                        data-id="${task.id}"
                        aria-label="Eliminar actividad"
                    >
                        🗑
                    </button>

                </div>

            </article>

        `;

    }).join("");

}

function escapeHTML(value) {

    return String(value).replace(/[&<>"']/g, character => {

        const entities = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
        };

        return entities[character];

    });

}

taskList.addEventListener("click", async (event) => {

    const button = event.target.closest("[data-action]");

    if (!button) return;

    const id = Number(button.dataset.id);

    const action = button.dataset.action;

    if (action === "edit") {
        await editTask(id);
    }

    if (action === "delete") {
        await removeTask(id);
    }

});

taskList.addEventListener("change", async (event) => {

    const checkbox = event.target.closest('[data-action="toggle"]');

    if (!checkbox) return;

    const id = Number(checkbox.dataset.id);

    const activity = (await getActivities()).find(
        task => task.id === id
    );

    if (!activity) return;

    activity.completed = checkbox.checked;

    activity.updatedAt = new Date().toISOString();

    if (activity.completed) {
        activity.notified = true;
    } else {
        activity.notified = false;
    }

    await updateActivity(activity);

    await addPendingSync({
        action: "update",
        data: activity,
        createdAt: new Date().toISOString()
    });

    await registerBackgroundSync();

    await renderTasks();

    if (navigator.onLine) {
        synchronizeData();
    }

});
async function editTask(id) {

    const activity = (await getActivities()).find(
        task => task.id === id
    );

    if (!activity) return;

    document.getElementById("taskId").value = activity.id;

    document.getElementById("taskTitle").value = activity.title;

    document.getElementById("taskDescription").value =
        activity.description;

    document.getElementById("taskDate").value = activity.date;

    document.getElementById("taskTime").value = activity.time;

    document.getElementById("taskPriority").value = activity.priority;

    document.getElementById("taskReminder").checked = activity.reminder;

    document.getElementById("modalTitle").textContent =
        "Modificar actividad";

    taskModal.classList.remove("hidden");

}

async function removeTask(id) {

    const confirmation = confirm(
        "¿Estás seguro de que deseas eliminar esta actividad?"
    );

    if (!confirmation) return;

    await deleteActivity(id);

    await addPendingSync({
        action: "delete",
        data: { id },
        createdAt: new Date().toISOString()
    });

    await registerBackgroundSync();

    await renderTasks();

    showToast("Actividad eliminada correctamente.");

    if (navigator.onLine) {
        synchronizeData();
    }

}

document.querySelectorAll(".filter-btn").forEach(button => {

    button.addEventListener("click", async () => {

        document.querySelectorAll(".filter-btn").forEach(btn => {
            btn.classList.remove("active");
        });

        button.classList.add("active");

        currentFilter = button.dataset.filter;

        await renderTasks();

    });

});

document.getElementById("refreshBtn").addEventListener("click", async () => {

    await renderTasks();

    if (navigator.onLine) {
        synchronizeData();
    }

    showToast("Actividades actualizadas.");

});

function showToast(message) {

    const toast = document.getElementById("toast");

    toast.textContent = message;

    toast.classList.add("show");

    setTimeout(() => {
        toast.classList.remove("show");
    }, 3000);

}

if ("serviceWorker" in navigator) {

    navigator.serviceWorker.addEventListener("message", event => {

        if (event.data?.type === "SYNC_REQUEST") {
            synchronizeData();
        }

    });

}
