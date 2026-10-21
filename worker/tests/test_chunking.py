import itertools

import pytest

from worker.chunking import CHUNK_OVERLAP, CHUNK_SIZE, chunk_pages
from worker.parsing import Page


def words(count: int, prefix: str = 'word') -> str:
    return ' '.join(f'{prefix}{number}' for number in range(count))


def test_a_short_page_becomes_a_single_chunk():
    chunks = chunk_pages([Page(number=1, text='A short page.')])

    assert [(c.chunk_index, c.page_number, c.content) for c in chunks] == [
        (0, 1, 'A short page.')
    ]


def test_each_chunk_carries_the_page_it_came_from():
    pages = [Page(number=1, text='Alpha.'), Page(number=2, text='Beta.')]

    chunks = chunk_pages(pages)

    assert [(c.page_number, c.content) for c in chunks] == [(1, 'Alpha.'), (2, 'Beta.')]


def test_chunk_numbers_keep_counting_across_pages():
    pages = [Page(number=1, text='One.'), Page(number=2, text='Two.')]

    chunks = chunk_pages(pages)

    assert [c.chunk_index for c in chunks] == [0, 1]


def test_a_chunk_never_mixes_two_pages():
    pages = [
        Page(number=1, text=words(300, 'alpha')),
        Page(number=2, text=words(300, 'beta')),
    ]

    chunks = chunk_pages(pages)

    assert {c.page_number for c in chunks} == {1, 2}

    for chunk in chunks:
        other_page_word = 'beta' if chunk.page_number == 1 else 'alpha'

        assert other_page_word not in chunk.content


def test_a_blank_page_produces_no_chunks_and_does_not_shift_later_page_numbers():
    pages = [
        Page(number=1, text='First.'),
        Page(number=2, text=''),
        Page(number=3, text='Third.'),
    ]

    chunks = chunk_pages(pages)

    assert [(c.chunk_index, c.page_number) for c in chunks] == [(0, 1), (1, 3)]


def test_plain_text_chunks_have_no_page_number():
    chunks = chunk_pages([Page(number=None, text=words(400))])

    assert len(chunks) > 1
    assert {c.page_number for c in chunks} == {None}


def test_no_chunk_is_longer_than_the_size_limit():
    chunks = chunk_pages([Page(number=1, text=words(2000))])

    assert max(len(c.content) for c in chunks) <= CHUNK_SIZE


def test_a_long_page_is_split_into_more_than_one_chunk():
    chunks = chunk_pages([Page(number=1, text=words(2000))])

    assert len(chunks) > 5


def test_neighbouring_chunks_overlap_by_about_the_overlap_size():
    chunks = chunk_pages([Page(number=1, text=words(2000))])

    for before, after in itertools.pairwise(chunks):
        tail = before.content[-CHUNK_OVERLAP:]
        first_word_of_next = after.content.split(' ')[0]

        assert first_word_of_next in tail


def test_every_word_of_the_page_appears_in_some_chunk():
    text = words(2000)

    chunks = chunk_pages([Page(number=1, text=text)])

    joined = ' '.join(c.content for c in chunks)
    assert set(text.split(' ')) <= set(joined.split(' '))


def test_a_paragraph_break_is_preferred_as_the_place_to_cut():
    first = 'x' * 700
    second = 'y' * 700

    chunks = chunk_pages([Page(number=1, text=f'{first}\n\n{second}')], 1000, 100)

    assert chunks[0].content == first


def test_text_with_no_spaces_is_still_cut_at_the_size_limit():
    chunks = chunk_pages([Page(number=1, text='z' * 2500)], 1000, 100)

    assert all(len(c.content) <= 1000 for c in chunks)
    assert sum(len(c.content) for c in chunks) >= 2500


def test_runs_of_spaces_and_blank_lines_are_tidied():
    chunks = chunk_pages([Page(number=1, text='one   two\t\tthree\n\n\n\n\nfour')])

    assert chunks[0].content == 'one two three\n\nfour'


def test_no_pages_gives_no_chunks():
    assert chunk_pages([]) == []


def test_an_overlap_that_is_too_large_is_rejected():
    with pytest.raises(ValueError, match='overlap'):
        chunk_pages([Page(number=1, text='text')], size=100, overlap=60)


def test_zero_overlap_splits_without_repeating_text():
    text = words(400)

    chunks = chunk_pages([Page(number=1, text=text)], 500, 0)

    assert ' '.join(c.content for c in chunks).split(' ') == text.split(' ')
