# AFE Career Tours report (emailed every Monday)

Every Monday at 9 AM (India time), Zuvy emails an Excel report of the AFE Career Tours to **join-zuvy@navgurukul.org**. It covers the week from the previous Monday 9 AM to this Monday 9 AM, in the column format the client asked for. Nobody has to prepare it by hand any more.

Code: `src/afe-report/`. Table: `zuvy_afe_report_runs` (migration `0048`).

## What is in the report

**One row = one student who signed up with a Student ID (without an email) and finished one tour.** A tour is one module of an AFE Career Tours course (AWS Data Center, Robotics Fulfillment Center or Amazon Music), in any language.

- **Finished** means the student submitted the tour's **feedback form** (the last form in the module). The time they submitted it is the `completion_date`.
- **Every finished tour is in exactly one report**: the one whose week contains its `completion_date`. Each report starts exactly where the last one ended, so nothing is sent twice or skipped.
- **Included:** Student ID accounts in all courses of the `AFE-Career-Tours` organisation (prod id 7), in every language, students and teachers.
- **Left out:** Google sign-in accounts, courses with "Dummy" in the name (test courses), and accounts with any staff role (admin, ops, instructor, …).
- If nobody finished a tour in the week, the email still goes out and says so.

The file has two sheets: **Report** (the data) and **About this report** (the period, notes, and where each column comes from).

### Columns

| Column                                 | Where it comes from                                                                                                                                          |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Student Name                           | Name on the Zuvy account; if empty, the name typed in the tour sign-up form                                                                                  |
| Student ID                             | The numeric Zuvy user id (the account's unique id)                                                                                                           |
| Email                                  | These students have no account email; filled only if they typed one in the tour sign-up form                                                                 |
| State, City, School name, School UDISE | Chosen at Student ID sign-up (City = UDISE district). UDISE empty if the student typed a school not in the list                                              |
| Student's grade                        | Tour sign-up form, e.g. `8`; several (`6, 7`) when a teacher ticked more than one                                                                            |
| Enter school type                      | Tour sign-up form, always in English                                                                                                                         |
| Course content                         | The tour, by its English name                                                                                                                                |
| Session ID                             | The login session in which the tour was finished: `CT_IN_<date>_<UDISE>_<number>` (`NUDISE` for a school not in the list)                                    |
| completion_date                        | When the feedback form was submitted, India time                                                                                                             |
| student_count                          | "How many students are watching with you" from the sign-up form; `1` if the answer is not a number from 1 to 500                                             |
| data_collection_method                 | `Classroom aggregation` if student_count > 1, else `Individual`                                                                                              |
| unit_type                              | `Students`; `Teachers` only for a teacher who watched alone                                                                                                  |
| itp_avg                                | Average of feedback Q5 (star rating 1–5) and Q6 (likely to recommend 0–10, converted to 1–5: 0 → 1, 10 → 5), one decimal. If only one was answered, that one |
| total_watch_time_seconds               | Total length of the tour's videos the student finished                                                                                                       |
| session_completed_flag                 | `1` if the student finished every video of the tour, else `0`                                                                                                |
| teacher_feedback_text                  | Feedback form free text (favourite part, suggestions), teachers only                                                                                         |
| data_source / partner_name             | Always `Zuvy Platform` / `Zuvy`                                                                                                                              |
| facilitator_name                       | Not asked in the forms, so empty                                                                                                                             |
| language                               | Language of the course (from the course name)                                                                                                                |

**How the forms are read.** Every language has its own copy of the sign-up and feedback forms. The Gujarati, Kannada, Marathi, Odia and Tamil sign-up forms ask the questions in a different order from English, Telugu and Hindi. So the code recognises each question by its type and options (the school type question has the `KGBV` option, the rating question has ⭐ options, and so on), never by its position. Teacher/Student is read from the option text, because option 1 is "Teacher" in English but "Student" in Hindi and Telugu. Tests run this against the real forms of all 8 languages (`src/afe-report/__fixtures__`).

**Keep the forms recognisable.** If an admin changes them, keep the `KGBV` option in school type, the ⭐ in the rating options, "Email" in the email question, and "Career Tours" or the digit 1 in the student count question. A new language course is picked up automatically if it follows the same pattern.

## The first report (already sent)

The first report was sent by hand on **20 Nov 2026** to join-zuvy@navgurukul.org. It covered everything **from the start to 20 Nov 2026, 4:00 PM India time**: 39 finished tours by 26 students. Nothing was recorded in the database for it, so the weekly job must be told where to carry on (`AFE_REPORT_START` below). The first automatic report then covers 20 Nov 4:00 PM to Monday 23 Nov 9:00 AM. After that, each report covers one week, Monday 9 AM to Monday 9 AM.

## Turning it on in production (DevOps)

1. **Apply the migration** `drizzle/migrations/0048_afe_report_runs.sql` to the production database (schema `main`). It only adds a table.
2. **Add to the production `.env`:**
   ```
   AFE_REPORT_ENABLED=true
   AFE_REPORT_ORG_ID=7
   AFE_REPORT_TO=join-zuvy@navgurukul.org
   AFE_REPORT_START=2026-11-20T16:00:00+05:30
   ```
   `AFE_REPORT_START` must stay exactly this value: the end of the first report. Without it, the first automatic report would repeat everything from the start. The email goes through the existing `SES_ACCESS_KEY_ID`, `SES_SECRET_ACCESS_KEY`, `AWS_REGION` and `SES_FROM_EMAIL` (noreply@zuvy.org). The SES key already has the `ses:SendRawEmail` permission needed for the attachment; the first report proved it.
3. **Deploy and restart** before Monday 9 AM. On start each server logs `AFE report email is on: every Monday from 9:00 IST to …, first report from 2026-11-20T10:30:00.000Z.`

The job checks every hour (at :05 India time). Every report ends at a Monday 9 AM. If the servers were down on Monday, the report goes out at the next check, still ending at that Monday 9 AM. All app servers run the check, but the runs table lets only one of them send each report.

Dev and staging never send: the report is off unless `AFE_REPORT_ENABLED=true`. **Don't turn it on from a laptop whose `.env` points at the production database.** That would email the client and record the report in production.

## Checking the report (super admin)

Both endpoints are in Swagger under **AFE Career Tours report**. Neither affects the weekly schedule. They work without `AFE_REPORT_ENABLED`, but need `AFE_REPORT_ORG_ID`.

- `GET /afe-report/preview?from=2026-11-17&to=2026-11-19` downloads the Excel file for those days (India time, both included). Leave out `from` for "from the start" and `to` for "until now".
- `POST /afe-report/send-test` with body `{ "from": "2026-11-17", "email": "you@navgurukul.org" }` emails the report with `[TEST]` in the subject, to you (or to `email`).

## Monitoring and problems

Every attempt is a row in `zuvy_afe_report_runs`:

```sql
SELECT id, window_start, window_end, status, row_count, recipients, error, created_at, sent_at
FROM zuvy_afe_report_runs ORDER BY id DESC LIMIT 10;
```

- `sent`: emailed; `row_count` = finished tours in it.
- `failed`: `error` says why. The same week is retried 3 hours later, then every 3 hours until it works. The next report still starts where the last _sent_ one ended, so nothing is lost.
- `sending` for more than 30 minutes: the server died mid-way. The next check marks it failed and retries.
- Don't delete `sent` rows, or the next report will repeat those tours. For a one-off copy, use `send-test`.

The email and the About sheet list data notes. For example: "7 video(s) in … have no length set, so total_watch_time_seconds is too low". Fix that by setting the video length in the course editor.
