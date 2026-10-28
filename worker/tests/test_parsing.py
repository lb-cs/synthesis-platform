import pytest

from tests.fakes import make_paragraph_pdf, make_pdf
from worker import parsing
from worker.parsing import ParseError, parse


def test_a_pdf_gives_one_entry_per_page_numbered_from_one():
    pdf = make_pdf(['First page text', 'Second page text', 'Third page text'])

    parsed = parse('pdf', pdf)

    assert [(page.number, page.text) for page in parsed.pages] == [
        (1, 'First page text'),
        (2, 'Second page text'),
        (3, 'Third page text'),
    ]


def test_a_blank_page_keeps_its_place_so_later_page_numbers_stay_right():
    pdf = make_pdf(['Page one', '', 'Page three'])

    parsed = parse('pdf', pdf)

    assert [(page.number, page.text) for page in parsed.pages] == [
        (1, 'Page one'),
        (2, ''),
        (3, 'Page three'),
    ]


def test_a_wrapped_pdf_paragraph_comes_back_as_one_line_with_paragraphs_kept_apart():
    first = 'Retrieval grounds a model in documents. ' * 4
    second = 'Each answer cites the passages it used. ' * 4
    pdf = make_paragraph_pdf([first, second])

    parsed = parse('pdf', pdf)

    assert parsed.pages[0].text == f'{first.strip()}\n\n{second.strip()}'


def test_pdf_details_go_to_metadata_with_the_page_count():
    pdf = make_pdf(['Hello'], metadata={'author': 'Ada Lovelace', 'title': 'Notes'})

    parsed = parse('pdf', pdf)

    assert parsed.metadata == {
        'page_count': 1,
        'author': 'Ada Lovelace',
        'title': 'Notes',
    }


def test_empty_pdf_details_are_left_out_of_metadata():
    parsed = parse('pdf', make_pdf(['Hello', 'World']))

    assert parsed.metadata == {'page_count': 2}


def test_a_damaged_pdf_fails_with_a_readable_message():
    with pytest.raises(ParseError) as error:
        parse('pdf', b'%PDF-1.7 hello')

    assert str(error.value) == parsing.NOT_A_PDF


def test_a_file_that_is_not_a_pdf_at_all_fails_with_a_readable_message():
    with pytest.raises(ParseError) as error:
        parse('pdf', b'just some bytes that are not a pdf')

    assert str(error.value) == parsing.NOT_A_PDF


def test_an_empty_file_fails_with_a_readable_message():
    with pytest.raises(ParseError) as error:
        parse('pdf', b'')

    assert str(error.value) == parsing.NOT_A_PDF


def test_a_password_protected_pdf_says_so():
    pdf = make_pdf(['Secret'], password='hunter2')

    with pytest.raises(ParseError) as error:
        parse('pdf', pdf)

    assert str(error.value) == parsing.PASSWORD_PROTECTED


def test_a_pdf_with_no_text_layer_says_it_may_be_a_scan():
    pdf = make_pdf(['', ''])

    with pytest.raises(ParseError) as error:
        parse('pdf', pdf)

    assert str(error.value) == parsing.NO_PDF_TEXT


def test_text_comes_back_as_one_entry_with_no_page_number():
    parsed = parse('text', b'Line one\nLine two\n')

    assert [(page.number, page.text) for page in parsed.pages] == [
        (None, 'Line one\nLine two')
    ]
    assert parsed.metadata == {'character_count': 17}


def test_windows_line_endings_and_a_byte_order_mark_are_removed():
    parsed = parse('text', b'\xef\xbb\xbfLine one\r\nLine two')

    assert parsed.pages[0].text == 'Line one\nLine two'


def test_text_that_is_not_utf8_asks_for_a_utf8_file():
    with pytest.raises(ParseError) as error:
        parse('text', 'café'.encode('cp1252'))

    assert str(error.value) == parsing.NOT_UTF8


def test_a_binary_file_with_a_text_extension_is_rejected():
    with pytest.raises(ParseError) as error:
        parse('text', b'abc\x00def')

    assert str(error.value) == parsing.NOT_TEXT


def test_a_text_file_of_only_whitespace_has_no_text():
    with pytest.raises(ParseError) as error:
        parse('text', b'  \n\n \t ')

    assert str(error.value) == parsing.NO_TEXT


def test_an_unsupported_kind_fails_with_a_readable_message():
    with pytest.raises(ParseError) as error:
        parse('spreadsheet', b'data')

    assert str(error.value) == 'Files of type "spreadsheet" are not supported.'
