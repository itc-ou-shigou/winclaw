"""Team coordination layer for multi-agent collaboration."""

from clawteam.team.lifecycle import LifecycleManager
from clawteam.team.mailbox import MailboxManager
from clawteam.team.manager import TeamManager
from clawteam.team.plan import PlanManager
from clawteam.team.tasks import TaskStore
from clawteam.team.watcher import InboxWatcher

__all__ = [
    "TeamManager",
    "MailboxManager",
    "TaskStore",
    "PlanManager",
    "LifecycleManager",
    "InboxWatcher",
]
