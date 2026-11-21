
async function requestNotificationPermission() {

    if (!("Notification" in window)) {
        showToast("Este navegador no admite notificaciones.");
        return false;
    }

    const permission = await Notification.requestPermission();

    if (permission === "granted") {
        showToast("¡Notificaciones activadas!");
        return true;
    }

    showToast("No se concedió el permiso de notificaciones.");
    return false;
}

async function showNotification(title, body, tag = "taskflow") {

    if (!("Notification" in window)) return;

    if (Notification.permission !== "granted") return;

    const options = {
        body: body,
        icon: "./assets/icon.svg",
        tag: tag,
        renotify: false
    };

    if ("serviceWorker" in navigator &&
        navigator.serviceWorker.controller) {

        const registration = await navigator.serviceWorker.ready;

        await registration.showNotification(title, options);

    } else {

        new Notification(title, options);

    }
}

async function checkReminders() {

    if (Notification.permission !== "granted") return;

    const activities = await getActivities();
    const now = Date.now();

    for (const activity of activities) {

        if (
            activity.reminder &&
            !activity.completed &&
            !activity.notified
        ) {

            const reminderDate = new Date(
                `${activity.date}T${activity.time}:00`
            ).getTime();

            if (reminderDate - (60 * 60 * 1000) <= now && reminderDate > 0) {

                await showNotification(
                    "Recordatorio de TaskFlow",
                    `Es momento de realizar: ${activity.title}`,
                    `activity-${activity.id}`
                );

                activity.notified = true;

                await updateActivity(activity);
            }
        }
    }
}
