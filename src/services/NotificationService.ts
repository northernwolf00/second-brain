import notifee, { TriggerType, RepeatFrequency, AndroidImportance } from '@notifee/react-native';
import { SearchService } from './SearchService';
import { Store } from '../store/mmkv';

export const NotificationService = {
  async requestPermission(): Promise<void> {
    await notifee.requestPermission();
  },

  async scheduleDailyResuface(): Promise<void> {
    const note = await SearchService.getRandomOldNote(30);
    if (!note) return;

    Store.setResurfaceNoteId(note.id);

    const channelId = await notifee.createChannel({
      id: 'daily-resurface',
      name: 'Daily resurface',
      importance: AndroidImportance.DEFAULT,
    });

    const now = new Date();
    const trigger = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      9, 0, 0, 0,
    );
    // If 9am already passed today, schedule for tomorrow
    if (trigger.getTime() <= Date.now()) {
      trigger.setDate(trigger.getDate() + 1);
    }

    await notifee.cancelAllNotifications();
    await notifee.createTriggerNotification(
      {
        title: 'Second Brain',
        body: `Remember: "${note.title}"`,
        android: { channelId, smallIcon: 'ic_launcher' },
        data: { noteId: note.id },
      },
      {
        type: TriggerType.TIMESTAMP,
        timestamp: trigger.getTime(),
        repeatFrequency: RepeatFrequency.DAILY,
      },
    );
  },
};
