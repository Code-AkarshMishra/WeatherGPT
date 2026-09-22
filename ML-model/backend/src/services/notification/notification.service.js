const logger = require('../../utils/logger');

class NotificationService {
  async dispatchAlertNotification(alert, targetUsers = []) {
    logger.info(`Dispatching alert notification for "${alert.title}" to ${targetUsers.length} subscribers.`);
    // Stub for Web Push / Firebase Cloud Messaging (FCM) / SMS Gateway integration
    return {
      success: true,
      alertId: alert.id,
      recipientsCount: targetUsers.length,
    };
  }
}

module.exports = new NotificationService();
