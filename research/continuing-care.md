# Continuing care across a blackout

The handoff now represents a continuing record: initial observation → procedure and plan → reassessment → updated observation, gaps and next check. The UI uses **medical team** for the recipient, without assuming that only a surgeon may read it.

## Current behavior

- A new routine packet requires a nonblank written observation, a next check, a future reassessment time and documented information gaps. “None identified” is an explicit crew statement; an empty field is not treated as proof that no gaps exist.
- Procedure status can be unknown, none followed, or followed with name and version. A missing version can be explicitly recorded as unknown. These are crew-entered records; the app does not verify clinical approval.
- The original packet is an independent snapshot. New care events append their own timestamp, observation, crew-reported change, procedure, next plan and remaining gaps. They do not rewrite the original observation or prior care events.
- New measured values attach only if their per-metric timestamps fall after the previous care event/original packet and no later than the reassessment. This works when several checks share a daily entry whose entry date is older. Crew and source must match the original packet. Absence of new readings stays visible; a written observation is not proof of a measurement or treatment.
- The latest plan determines the due label. Old packets without a plan remain readable and can receive a reassessment. Nothing silently closes a care thread or declares a person recovered.
- JSON packet downloads include the original packet, all its care events, procedure versions, gaps and timestamps. Ground JSON/Markdown include continuing-care records too. Data remains in IndexedDB across reloads and offline use; crew deletion and personal-data clearing remove the corresponding events.

## What “sending” means here

There is no transport service, clinician inbox or connected spacecraft/ground link. The previous “Queued” label suggested a sender that did not exist. New packets use a local saved status; older queued packets are still readable. The UI says **Saved on this device** and **File downloaded · delivery not confirmed**.

Download the file and transfer it through an authorized mission communication channel when available. GhostPilot cannot confirm that the transfer happened or that a clinician read it. Delay and blackout controls are scenarios, not measured link status. No external message or health record is sent by this change.

## Future ground-response import

This is not implemented. A later importer should bind a response to the original packet ID, crew and mission, retain its author/reviewer, procedure version, issued/reviewed times and provenance, validate the file and require explicit review before instructions are presented as approved. Imported instructions should append to the existing care history rather than replace crew observations. A file’s claim to be “reviewed” cannot by itself establish trust. Current exports set the ground response to null and never invent one.

## Measurement validity

Personal movement comparison now starts with actual crew video and an explicitly linked retained reference recording. A reference angle without a video is shown as a missing reference video. Conditions gate comparison, and a single pair does not establish a health trend. Synthetic pose replay and the public D-NeRF 4DGS model are labelled demonstrations; neither supplies measurement evidence about a real crew member.

No real-participant study has been run. The [study protocol and analysis kit](human-study/PROTOCOL.md) are ready for collection; the supplied report is pending with zero participants. Any future report must distinguish repeatability from accuracy, use a matching physical reference, count failed captures and keep correlated repetitions separate from participant count.
