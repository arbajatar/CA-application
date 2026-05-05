<?php

namespace App\Enums;

enum TaskStatus: string
{
    case Assigned = 'assigned';
    case InProgress = 'in_progress';
    case AwaitingInformation = 'awaiting_information';
    case Completed = 'completed';

    public function label(): string
    {
        return match ($this) {
            TaskStatus::Assigned => 'Assigned',
            TaskStatus::InProgress => 'In Progress',
            TaskStatus::AwaitingInformation => 'Awaiting Information',
            TaskStatus::Completed => 'Completed',
        };
    }

    public function allowedTransitions(): array
    {
        return match ($this) {
            TaskStatus::Assigned => [TaskStatus::InProgress],
            TaskStatus::InProgress => [TaskStatus::AwaitingInformation, TaskStatus::Completed],
            TaskStatus::AwaitingInformation => [TaskStatus::InProgress, TaskStatus::Completed],
            TaskStatus::Completed => [],
        };
    }

    public function canTransitionTo(TaskStatus $next): bool
    {
        return in_array($next, $this->allowedTransitions());
    }
}