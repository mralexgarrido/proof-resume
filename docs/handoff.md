# Local evidence handoff, version 1

An assignment tool can prepare a **local JSON file** that a student opens in Proof. This is an optional file handoff between independent applications. It does not require a connection, account, API, or changes to how an assignment is graded.

Proof previews the project before importing it. The student decides whether to add it, supplies their role, edits the claims, and reviews each contribution. Imported material is never automatically marked reviewed. Importing adds evidence to the library; it does not establish that the claims are accurate or that they belong in a particular resume version.

## File contract

The JSON object must use these exact, case-sensitive fields:

| Field | Type | Requirement |
| --- | --- | --- |
| `app` | string | Required. Exactly `proof-evidence`. |
| `version` | number | Required. Exactly `1`. |
| `title` | string | Required and nonempty. The project or assignment name. |
| `source` | string | Required. One of `course`, `work`, `campus`, `volunteer`, `personal`, or `community`. |
| `status` | string | Required. One of `coursework`, `proposal`, `simulation`, `prototype`, `tested`, `live`, `ongoing`, or `completed`. |
| `contributions` | array of objects | Required and nonempty. One object per distinct student contribution. |

Each contribution may contain the following string fields. Include only information the student supplied or can inspect in their work. At least `action` or `text` must be nonempty.

| Field | Meaning |
| --- | --- |
| `action` | What the student personally did. |
| `method` | Tool, approach, process, or constraint. |
| `result` | An observed result or actual deliverable. |
| `evidence` | A private artifact reference, observation, or explanation of the basis for a claim. |
| `reflection` | A private account of a decision, lesson, or contribution boundary. |
| `text` | A student-written draft resume bullet, if one exists. |

Unknown fields are rejected. Do not supply IDs, contact details, grades, reviewer claims, executable markup, files, or nested objects in a contribution. This format accepts plain text only. Normal application capacity limits apply; oversized or malformed files are rejected rather than silently shortening valid content.

## Example

The following is fictional and illustrates the format. It must not be inserted into a student's work as their own accomplishment.

```json
{
  "app": "proof-evidence",
  "version": 1,
  "title": "Campus event campaign planning exercise",
  "source": "course",
  "status": "simulation",
  "contributions": [
    {
      "action": "Prepared a campaign structure for a campus event",
      "method": "the class advertising simulator and an audience planning worksheet",
      "result": "documented the audience, creative choices, budget allocation, and measurement plan",
      "evidence": "My simulator submission and planning worksheet",
      "reflection": "This was a simulation. No ads ran, and I did not measure conversions or revenue.",
      "text": "Prepared a simulated campus event campaign with an audience rationale, budget allocation, and measurement plan."
    }
  ]
}
```

## Import behavior

`ProofCore.normalizeHandoff(raw)` validates this contract and returns an array containing one new experience for the preview workflow:

1. `title` becomes the experience's organization or project name.
2. `source` selects its default resume section. The source is preserved.
3. `status` is preserved. A simulation remains a simulation.
4. Role, location, and dates start empty for the student to supply.
5. The experience and every contribution receive new local IDs.
6. Every contribution begins with `reviewed: false`; the student supplies any attribution detail.
7. Evidence and reflection remain private library data. They are excluded from resume Word, text, and print projections.

The preview must make it possible to cancel without changing the current project. Confirmation adds the imported project to the evidence library. The student then selects evidence for a resume version explicitly.

## Guidance for assignment tools

- Export the student's own choices and work. Do not create achievements, numerical gains, or professional outcomes from a simulated assignment.
- Set the stage accurately. A completed simulation should still use `simulation`, and a completed proposal should still use `proposal`.
- Leave unknown fields empty or omit them. A proposed measure is a plan, not an observed result.
- Treat a team result separately from an individual's action. The student can explain the boundary during review in Proof.
- Offer the file as an optional download. Do not send it elsewhere, grade it, or import it automatically.
- Let the student inspect what is included. Private notes may travel in the JSON file even though they do not appear in a resume.

No integrations with other repositories are included by publishing this specification. An assignment tool would need its own separately reviewed export implementation.
