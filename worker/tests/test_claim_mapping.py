"""
How a claim's rows become ClaimedSource. The migration and the worker deploy at different
moments, so the mapping must survive a claim with one column more or one fewer.
"""

from typing import Any

from worker.db import ClaimedSource, SourcesQueue


class FakeRpcClient:
    def __init__(self, rows: list[dict[str, Any]]) -> None:
        self.data = rows

    def rpc(self, name: str, params: dict[str, Any]):
        return self

    def execute(self):
        return self


def claim(rows: list[dict[str, Any]]) -> list[ClaimedSource]:
    return SourcesQueue(FakeRpcClient(rows)).claim(5)


FILE_ROW = {'id': 's1', 'project_id': 'p1', 'kind': 'pdf', 'storage_path': 'u/p/f.pdf'}


def test_a_claimed_link_keeps_its_url():
    link = {**FILE_ROW, 'kind': 'link', 'storage_path': None, 'url': 'https://a.example'}

    assert claim([link]) == [
        ClaimedSource(
            id='s1',
            project_id='p1',
            kind='link',
            storage_path=None,
            url='https://a.example',
        )
    ]


def test_a_claim_from_before_the_url_column_still_maps():
    assert claim([FILE_ROW])[0].url is None


def test_a_column_the_worker_does_not_know_is_ignored():
    newer = {**FILE_ROW, 'url': None, 'added_later': 'x'}

    assert claim([newer])[0].id == 's1'
