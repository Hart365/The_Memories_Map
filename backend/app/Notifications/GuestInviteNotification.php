<?php

namespace App\Notifications;

use App\Models\MemoriesMap;
use Carbon\CarbonInterface;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class GuestInviteNotification extends Notification
{
    use Queueable;

    public function __construct(
        private readonly MemoriesMap $map,
        private readonly string $shareUrl,
        private readonly ?CarbonInterface $expiresAt = null,
        private readonly bool $isReset = false,
    ) {}

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $subject = $this->isReset
            ? 'Updated secure link for shared map access'
            : 'A memories map has been shared with you';

        $actionText = $this->isReset ? 'Open updated secure link' : 'Open secure link';

        $mail = (new MailMessage())
            ->subject($subject)
            ->greeting('Hello,')
            ->line('"' . $this->map->name . '" has been shared with you with read-only access.')
            ->line('For security, this link only works for ' . $notifiable->email . '. You will be asked to confirm that email address before the map opens.')
            ->action($actionText, $this->shareUrl)
            ->line('This invitation is non-discoverable and cannot be used without both the secure link and the invited email address.');

        if ($this->expiresAt) {
            $mail->line('This link expires on ' . $this->expiresAt->toDayDateTimeString() . '.');
        }

        return $mail;
    }
}