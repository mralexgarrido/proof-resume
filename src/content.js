/* Bundled questions and examples. No generated claims or remote content. */
const ProofContent = (() => {
  'use strict';

  const lenses = [
    {
      id: 'decision',
      label: 'A decision you made',
      question: 'When did you choose an approach instead of simply following instructions?',
      followup: 'What choices did you consider? Describe your choice and the evidence you used.'
    },
    {
      id: 'messy-moment',
      label: 'A messy moment',
      question: 'Think of a confusing request, an error, or a busy day. What did you personally do?',
      followup: 'What became clearer or easier afterward? A useful handoff counts, even without a number.'
    },
    {
      id: 'artifact',
      label: 'Something you made',
      question: 'What document, design, analysis, prototype, or tool can you point to?',
      followup: 'Name your part, how you made it, and who used it. Keep proposals separate from live results.'
    },
    {
      id: 'constraint',
      label: 'A limitation you worked around',
      question: 'When did limited time, money, information, or materials affect your work?',
      followup: 'What did you change because of that limitation? Describe the tradeoff you actually made.'
    },
    {
      id: 'handoff',
      label: 'A better handoff',
      question: 'When did someone rely on your notes, explanation, schedule, or instructions?',
      followup: 'What did you prepare, who needed it, and how do you know it helped them use the work?'
    },
    {
      id: 'pattern',
      label: 'A pattern you noticed',
      question: 'What did you notice in data, feedback, customer questions, or repeated tasks?',
      followup: 'Explain how you checked the pattern and what you did with it. An observation is not a proven cause.'
    },
    {
      id: 'reliability',
      label: 'A responsibility people trusted you with',
      question: 'What did people count on you to keep accurate, organized, or ready?',
      followup: 'Describe the scope and process. Everyday consistency is evidence when you make it concrete.'
    },
    {
      id: 'learning',
      label: 'A problem you learned to solve',
      question: 'What could you do by the end of a project that you could not do at the beginning?',
      followup: 'Point to a specific application of the skill. Name any guidance you still needed.'
    },
    {
      id: 'team',
      label: 'Your part in a team',
      question: 'What work or decision was specifically yours in a shared project?',
      followup: 'Separate your contribution from the team result. Helping a team succeed does not require claiming all its work.'
    },
    {
      id: 'community',
      label: 'Work outside a job title',
      question: 'Where have you organized, explained, translated, cared for, or coordinated something in your community?',
      followup: 'Describe the real responsibility and your contribution using a role you can comfortably explain.'
    }
  ];

  const verbs = [
    {label: 'Research and investigate', words: ['Researched', 'Interviewed', 'Surveyed', 'Observed', 'Compared', 'Reviewed', 'Investigated', 'Synthesized']},
    {label: 'Analyze and check', words: ['Analyzed', 'Calculated', 'Classified', 'Evaluated', 'Reconciled', 'Validated', 'Tested', 'Audited']},
    {label: 'Create and develop', words: ['Created', 'Designed', 'Developed', 'Drafted', 'Built', 'Modeled', 'Prototyped', 'Adapted']},
    {label: 'Explain and communicate', words: ['Presented', 'Explained', 'Documented', 'Edited', 'Translated', 'Summarized', 'Demonstrated', 'Clarified']},
    {label: 'Organize and deliver', words: ['Organized', 'Scheduled', 'Coordinated', 'Prepared', 'Maintained', 'Tracked', 'Processed', 'Implemented']},
    {label: 'Support and collaborate', words: ['Supported', 'Assisted', 'Facilitated', 'Collaborated', 'Guided', 'Mentored', 'Trained', 'Responded']},
    {label: 'Improve a process', words: ['Revised', 'Standardized', 'Simplified', 'Consolidated', 'Troubleshot', 'Streamlined', 'Updated', 'Resolved']},
    {label: 'Technical and practical work', words: ['Configured', 'Programmed', 'Assembled', 'Measured', 'Mapped', 'Visualized', 'Recorded', 'Inspected']}
  ];

  const examples = [
    {
      label: 'Marketing (fictional)',
      before: 'Helped with a social media campaign.',
      after: 'Developed a four-week content calendar and six campaign mockups for a class proposal, using survey findings to choose the content themes.',
      why: 'Names the student contribution, method, and deliverable. A proposal demonstrates planning without claiming sales from a campaign that never ran.'
    },
    {
      label: 'Business and retail (fictional)',
      before: 'Responsible for inventory.',
      after: 'Organized weekly stock checks across four product categories and documented discrepancies for the shift lead.',
      why: 'Makes routine work visible through scope and a useful handoff. It does not invent a reduction in inventory loss.'
    },
    {
      label: 'Analytics (fictional)',
      before: 'Good at Excel and data analysis.',
      after: 'Cleaned a course survey dataset in Excel, checked duplicate responses, and built pivot tables to compare preferences across three student groups.',
      why: 'Shows what happened inside the tool. Specific tasks tell a reader more than a proficiency label.'
    },
    {
      label: 'Engineering (fictional)',
      before: 'Worked on a team design project.',
      after: 'Modeled a prototype housing in CAD and documented three design revisions based on team fit tests.',
      why: 'Separates one contribution from the team project and identifies the evidence behind the revisions.'
    },
    {
      label: 'Humanities (fictional)',
      before: 'Strong research and communication skills.',
      after: 'Compared eight primary sources for a local history project and prepared an annotated exhibit guide for a campus presentation.',
      why: 'Makes research and communication observable through the materials examined and the work delivered.'
    },
    {
      label: 'Science (fictional)',
      before: 'Participated in laboratory work.',
      after: 'Recorded measurements for a course experiment and checked missing entries against the laboratory notebook before preparing the results table.',
      why: 'Explains a specific contribution to data quality without claiming ownership of the whole experiment or its findings.'
    },
    {
      label: 'Education (fictional)',
      before: 'Helped students learn.',
      after: 'Prepared fraction practice activities for a supervised tutoring session and revised the instructions after observing where learners needed clarification.',
      why: 'Shows preparation, observation, and a concrete revision. It does not infer an improvement in test scores.'
    },
    {
      label: 'Community and languages (fictional)',
      before: 'Bilingual and organized.',
      after: 'Translated event instructions into Spanish and maintained a volunteer schedule for a neighborhood supply distribution.',
      why: 'Uses community work to show language skills and coordination through actual responsibilities.'
    },
    {
      label: 'Computing (fictional)',
      before: 'Made an application.',
      after: 'Built a local budget tracker in JavaScript and tested its calculations with sample transactions before sharing the prototype with classmates.',
      why: 'Names the implementation, testing method, and project stage. A prototype is useful evidence without implying production adoption.'
    },
    {
      label: 'Design (fictional)',
      before: 'Creative and detail oriented.',
      after: 'Designed two event flyer layouts and revised typography and spacing after a peer readability review.',
      why: 'Connects design choices to a review process rather than using a personality claim as evidence.'
    }
  ];

  const projects = [
    {
      category: 'Marketing',
      title: 'Audience decision brief',
      prompt: 'Choose an existing product or campus service. Compare two plausible audiences using materials you already have, identify what is known versus assumed, and write a one-page recommendation. Save the comparison and explain why you chose one audience. Label the work as a practice proposal.'
    },
    {
      category: 'Marketing',
      title: 'Campaign measurement plan',
      prompt: 'Take a class campaign idea and define its objective, audience, budget allocation, and three measures you would use to evaluate it. Explain how each measure connects to the objective. Save the plan as evidence of campaign design, not evidence of performance.'
    },
    {
      category: 'Marketing',
      title: 'Creative comparison',
      prompt: 'Create two versions of a message for the same audience. Annotate what you changed, why, and how you would test the difference. Keep the drafts and rationale. Without a real test, describe this as a creative proposal rather than a winning version.'
    },
    {
      category: 'Business',
      title: 'A clearer operating checklist',
      prompt: 'Map a recurring task you know well, such as preparing a club meeting or managing a shared schedule. Create a checklist and test it on the next permitted occasion. Record which instructions needed revision and keep both versions.'
    },
    {
      category: 'Business',
      title: 'Cost comparison model',
      prompt: 'Compare two options for a small event or project using prices you already have. Build a spreadsheet that separates fixed costs, variable costs, and assumptions. Check the formulas with a second scenario. Save the model and the decision it supports; do not describe hypothetical savings as realized savings.'
    },
    {
      category: 'Analytics',
      title: 'A reproducible data cleanup',
      prompt: 'Use a class dataset or clearly labeled sample rows. Document duplicate, missing, and inconsistent values; clean them with a repeatable process; and make one useful table or chart. Keep a change log so another person can reproduce your work.'
    },
    {
      category: 'Computing',
      title: 'One small local tool',
      prompt: 'Build a calculator, tracker, or form that runs locally. Write down the task it addresses, test normal and edge cases, and prepare a short usage guide. Save the code and test notes. Describe the tool as a prototype until you have evidence of actual use.'
    },
    {
      category: 'Engineering',
      title: 'A documented design tradeoff',
      prompt: 'Choose a course design problem. Compare two approaches against the same constraints, build a permitted model or diagram, and document why you selected one. Keep the comparison and any test notes so you can explain your decision.'
    },
    {
      category: 'Humanities',
      title: 'A source comparison for a reader',
      prompt: 'Compare several sources you already have on one narrow question. Identify agreement, disagreement, and limitations, then create an annotated guide for a specific audience. Save your source notes and explain the choices behind the guide.'
    },
    {
      category: 'Science',
      title: 'A traceable results table',
      prompt: 'Use an existing course dataset. Prepare a results table with units, missing-data notes, and a record of any calculations. Check it against the original data and write a short explanation of what the table supports and what it does not establish.'
    },
    {
      category: 'Education',
      title: 'Instructions that survive a first reading',
      prompt: 'Create a short learning activity for a topic you understand. Ask a willing peer to follow the instructions, note where clarification was needed, and revise them. Keep the activity and revision notes. Describe the observed feedback rather than assuming a learning gain.'
    },
    {
      category: 'Design',
      title: 'A readability revision',
      prompt: 'Revise a flyer, slide, or information sheet you are allowed to edit. Compare the original and revised hierarchy, wording, and spacing. Ask a willing peer what they notice first and what remains unclear. Save the annotated comparison and feedback.'
    },
    {
      category: 'Community',
      title: 'A practical bilingual guide',
      prompt: 'Create a short bilingual guide for an event or everyday process you know. Have a fluent reviewer check the meaning and usability, then record the revisions. Keep the final guide and describe your translation and review process accurately.'
    },
    {
      category: 'All majors',
      title: 'A handoff someone else can use',
      prompt: 'Document a project you have completed so another person can find the files, understand the decisions, and continue the work. Ask a willing peer to locate one item using only your guide. Revise the unclear steps and keep the guide as evidence of practical communication.'
    }
  ];

  const practiceLevels = [
    {value: '', label: 'Choose a practice description'},
    {value: 'guided', label: 'Used with guidance'},
    {value: 'independent', label: 'Applied independently'},
    {value: 'repeated', label: 'Applied across several projects'},
    {value: 'taught', label: 'Explained or taught to others'}
  ];

  const statuses = [
    {value: 'coursework', label: 'Coursework'},
    {value: 'proposal', label: 'Proposal'},
    {value: 'simulation', label: 'Simulation'},
    {value: 'prototype', label: 'Prototype'},
    {value: 'tested', label: 'Tested'},
    {value: 'live', label: 'Live or in use'},
    {value: 'ongoing', label: 'Ongoing work'},
    {value: 'completed', label: 'Completed work'}
  ];

  const attribution = [
    {value: 'personal', label: 'My own contribution'},
    {value: 'team', label: 'A shared team contribution'},
    {value: 'support', label: 'I supported this work'}
  ];

  const tips = {
    discover: 'Start with one real moment. What did you make, change, explain, or keep working? You can add the details later.',
    details: 'Use contact details you check regularly. City and state are enough; add a portfolio only when you are comfortable sharing the work.',
    education: 'Early in your career, a course project can show what you are ready to do. Name your degree or program and use Expected for a future graduation date.',
    library: 'Keep more evidence than one resume needs. Separate your contribution from a team result, and identify a proposal or simulation as such.',
    versions: 'Choose evidence for this opportunity. A phrase match helps you find a card; you decide whether that card really supports the requirement.',
    skills: 'Connect a skill to work you can explain or demonstrate. Your practice level describes your experience, not a test score or permanent label.',
    interview: 'Practice explaining the work behind your own words. What was yours, how do you know, and what did you learn? Private preparation stays separate from your resume.',
    finish: 'Read the export as someone meeting you for the first time. Keep the strongest relevant evidence, then check the final page breaks before sharing it.'
  };

  return Object.freeze({lenses, verbs, examples, projects, practiceLevels, statuses, attribution, tips});
})();
