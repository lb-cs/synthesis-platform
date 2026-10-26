from supabase import Client

BUCKET = 'sources'


class SourceFiles:
    """Reads uploaded files from the private `sources` bucket."""

    def __init__(self, client: Client) -> None:
        self._bucket = client.storage.from_(BUCKET)

    def download(self, storage_path: str) -> bytes:
        return self._bucket.download(storage_path)
