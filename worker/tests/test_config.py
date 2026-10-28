import pytest

from worker.config import ConfigError, load_config

REQUIRED = {
    'SUPABASE_URL': 'http://127.0.0.1:54321',
    'SUPABASE_SERVICE_ROLE_KEY': 'sb_secret_test',
    'OPENAI_API_KEY': 'sk-test',
}


def test_uses_defaults_when_only_the_required_values_are_set():
    config = load_config(REQUIRED)

    assert config.concurrency == 4
    assert config.poll_interval_seconds == 5
    assert config.stale_after_minutes == 15


def test_refuses_to_start_without_the_service_role_key():
    with pytest.raises(ConfigError, match='SUPABASE_SERVICE_ROLE_KEY'):
        load_config({'SUPABASE_URL': 'http://127.0.0.1:54321'})


def test_refuses_to_start_without_the_openai_key():
    values = dict(REQUIRED)
    values.pop('OPENAI_API_KEY')

    with pytest.raises(ConfigError, match='OPENAI_API_KEY'):
        load_config(values)


def test_reads_overrides():
    config = load_config({**REQUIRED, 'WORKER_CONCURRENCY': '8'})

    assert config.concurrency == 8


@pytest.mark.parametrize('value', ['0', '-2', 'many', '1.5'])
def test_rejects_a_concurrency_that_is_not_a_positive_whole_number(value: str):
    with pytest.raises(ConfigError, match='WORKER_CONCURRENCY'):
        load_config({**REQUIRED, 'WORKER_CONCURRENCY': value})
