"""Abstract base class for message transport."""

from __future__ import annotations

from abc import ABC, abstractmethod


class Transport(ABC):
    """Transport interface for delivering and fetching raw message bytes."""

    @abstractmethod
    def deliver(self, recipient: str, data: bytes) -> None:
        """Deliver message bytes to a recipient's inbox."""

    @abstractmethod
    def fetch(self, agent_name: str, limit: int = 10, consume: bool = True) -> list[bytes]:
        """Fetch messages. consume=True removes them (receive), False keeps them (peek)."""

    @abstractmethod
    def count(self, agent_name: str) -> int:
        """Return the number of pending messages."""

    @abstractmethod
    def list_recipients(self) -> list[str]:
        """List all known recipient names (for broadcast)."""

    def close(self) -> None:
        """Release resources. Default is no-op."""
