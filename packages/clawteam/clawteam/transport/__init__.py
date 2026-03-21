"""Pluggable transport backends for message delivery."""

from __future__ import annotations

from clawteam.transport.base import Transport


def get_transport(name: str, team_name: str, **kwargs) -> Transport:
    """Factory: create a transport by name."""
    if name == "p2p":
        from clawteam.transport.p2p import P2PTransport
        return P2PTransport(team_name, **kwargs)
    from clawteam.transport.file import FileTransport
    return FileTransport(team_name)


__all__ = ["Transport", "get_transport"]
