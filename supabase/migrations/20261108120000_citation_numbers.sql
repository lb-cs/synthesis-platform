-- Chat retrieves chunks (CECS491-73): an answer cites the passages it was sent as [1],
-- [2], … and the numbers restart with every answer. Storing the number lets a saved
-- answer link each [n] back to its chunk, and so to the source and page.
--
-- Not null is safe: nothing wrote citations before this change.

alter table public.citations
  add column number integer not null check (number > 0);

-- One chunk per number in an answer.
alter table public.citations
  add constraint citations_message_id_number_key unique (message_id, number);
