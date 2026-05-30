<?php

namespace App\Enums;

enum TaskStatus: string
{
    case Complete = 'complete';
    case WorkInProgress = 'work_in_progress';
    case Pending = 'pending';
    case NotToBeDone = 'not_to_be_done';
    case Other = 'other';
    case Assigned = 'assigned';

    public function label(): string
    {
        return match ($this) {
            TaskStatus::Complete       => 'Complete',
            TaskStatus::WorkInProgress => 'Work In Progress',
            TaskStatus::Pending        => 'Pending',
            TaskStatus::NotToBeDone    => 'Not To Be Done',
            TaskStatus::Other          => 'Other',
            TaskStatus::Assigned       => 'Assigned',
        };
    }

    public function allowedTransitions(): array
    {
        return match ($this) {
            TaskStatus::Pending        => [TaskStatus::WorkInProgress, TaskStatus::NotToBeDone, TaskStatus::Other],
            TaskStatus::WorkInProgress => [TaskStatus::Complete, TaskStatus::Pending, TaskStatus::NotToBeDone, TaskStatus::Other],
            TaskStatus::Complete       => [TaskStatus::WorkInProgress, TaskStatus::Pending],
            TaskStatus::NotToBeDone    => [TaskStatus::Pending, TaskStatus::WorkInProgress],
            TaskStatus::Other          => [TaskStatus::Pending, TaskStatus::WorkInProgress, TaskStatus::Complete],
            TaskStatus::Assigned       => [TaskStatus::WorkInProgress, TaskStatus::Pending, TaskStatus::NotToBeDone, TaskStatus::Other, TaskStatus::Complete],
        };
    }

    public function canTransitionTo(TaskStatus $next): bool
    {
        return in_array($next, $this->allowedTransitions());
    }
}