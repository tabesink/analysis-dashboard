"""Entry point for running the server as a module."""

import sys
from pathlib import Path

# Add project root to Python path
project_root = Path(__file__).parent.parent
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

def main() -> None:
    import uvicorn
    from server.config import get_settings

    settings = get_settings()
    uvicorn.run(
        "server.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
    )


if __name__ == "__main__":
    main()

