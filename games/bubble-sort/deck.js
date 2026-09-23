/*
 * deck.js - the card copy for Bubble Sort.
 *
 * Nothing in here is a number from the survey or a fact. Facts come from window.DC_FACTS and survey
 * figures from window.Survey at runtime (see game.js). This file only holds:
 *   - which ids can be dealt,
 *   - the spoken-sentence wording of the survey's opinion items,
 *   - the "why this bin" explanations,
 *   - the flavour tags printed on each card.
 * Templates use {source} and {year}, filled in from DC_FACTS.
 */
window.BUBBLE_DECK = {
  data: {
    pool: ['ie-share-2025', 'ie-wind-dd', 'ie-tallaght', 'ie-jobs', 'ie-water', 'global-2024', 'streaming', 'ie-rese'],
    // Every run gets one alarming-sounding DATA card and one that sounds like a take but was measured.
    alarming: ['ie-share-2025', 'ie-water'],
    soundsLikeOpinion: ['streaming', 'ie-tallaght'],
    // Shorten a long fact for the card face by cutting DC_FACTS text at this marker (text stays verbatim).
    cut: { 'ie-jobs': '. Construction', 'ie-water': ' (over 200', 'streaming': ' - the IEA' },
    why: {
      'ie-share-2025': 'It sounds alarming - but alarming isn’t the same as opinion. {source} measured it from meter readings, and you can check it.',
      'ie-wind-dd': 'Sounds technical, and it is simply measured: {source} counts how much available wind power went unused.',
      'ie-tallaght': 'A real scheme you can look up, with a measured saving. It sounds like good PR, but it’s data with a source ({source}).',
      'ie-jobs': 'Estimated in a report for the Department of Enterprise ({source}). You can argue about what the jobs mean, but the estimate has a source and a method.',
      'ie-water': 'Reported by {source}. The first half sounds reassuring and the second alarming - but both halves are data with a source.',
      'global-2024': 'An estimate built from measured energy data, published by {source} with its method. That’s data you can check.',
      'streaming': '“Went viral” makes it sound like a hot take - but this is {source} re-checking the maths. Measured, sourced, checkable.',
      'ie-rese': 'Measured by {source} from grid data. The 2030 target is a goal, but the {year} share is a measurement.',
    },
    whyDefault: 'It was measured by {source} ({year}) and you can check it. That’s what makes it data.',
  },

  opinion: {
    pool: ['q26', 'q42', 'q46', 'q50', 'q69', 'q101', 'q31'],
    // These two sound factual on purpose; every run deals at least one of them.
    factSounding: ['q46', 'q50'],
    say: {
      q26: 'Data centres are putting an unacceptable strain on our national grid.',
      q42: 'That land should be going to housing, not to data centres.',
      q46: 'Data centres are necessary infrastructure for a modern digital economy.',
      q50: 'Ireland benefits economically from being a hub for data centre investment.',
      q69: 'With data centres, the interests of big tech outweigh those of ordinary people.',
      q101: 'No data centre should be approved without the community’s consent. It should be the law.',
      q31: 'Data centres should be required by law to use 100% renewable energy.',
    },
    why: {
      q26: '“Unacceptable” is a judgement. The load on the grid can be measured; whether it’s too much depends on what you value.',
      q42: 'It’s about priorities - homes or data centres. “Should” tells you it’s a view about what ought to happen, not a fact.',
      q46: 'Sounds like a fact, right? It’s a judgement - “necessary” depends on what kind of economy you want.',
      q50: 'Sounds like a fact, right? It’s a judgement - “benefits” depends on who you ask and what you count.',
      q69: 'It’s a claim about fairness - whose interests should count for more. No meter can measure that.',
      q101: 'It’s a view about what the law should say. You can argue for it or against it, but you can’t prove it.',
      q31: 'A policy wish. Whether the law should demand it is a judgement, not something you can fact-check.',
    },
  },

  assume: {
    pool: ['q18', 'q19', 'q20', 'q21', 'q22', 'q23', 'q24', 'q25'],
    mustInclude: ['q18'],
    // Answer-key verdict 'true' - every run deals at least one, so players see an assumption can be right.
    trueOnes: ['q20', 'q23', 'q24', 'q25'],
    // Shown before the player guesses true/false, so it must not hint at the answer.
    why: 'It’s a claim about how things are, and it could be checked - but it comes with no evidence. That makes it an assumption.',
    // Shown next to the verdict chip, after the guess.
    after: {
      true: 'Assumptions can be right - they just need checking.',
      false: 'Once checked, it falls apart.',
      partly: 'Once checked, it’s more complicated than it sounds.',
    },
  },

  // When an assumption lands in the wrong bubble (key: chosen bubble). Must not hint at true/false.
  miss: {
    data: 'No source was given, so it isn’t data - it’s a claim that still needs checking.',
    opinion: 'It isn’t a judgement about good or bad. It’s a claim about how things are - and that can be checked.',
  },

  // Flavour tags for every card without a source. One shared pool, dealt at random to OPINION and
  // ASSUMPTION cards alike, so the tag never gives the answer away. Never a real person's name.
  tags: [
    'Said at a public meeting', 'Heard in conversation', 'Seen on social media', 'Radio phone-in',
    'Shared in a group chat', 'Comment at a council hearing', 'Letter to the editor', 'Comment under a video',
    'Overheard on the bus',
  ],

  // Display names for the q16 information sources (matched by the start of the survey label).
  cohorts: [
    { match: /^Social media/i, name: 'Social Media', icon: 'phone' },
    { match: /^Online news/i, name: 'Online News', icon: 'browser' },
    { match: /^Friends/i, name: 'Friends & Family', icon: 'people' },
    { match: /^Local community/i, name: 'Community Meeting', icon: 'hall' },
    { match: /^National news/i, name: 'National News', icon: 'radio' },
    { match: /^Environmental/i, name: 'Green Groups', icon: 'leaf' },
    { match: /^Academic/i, name: 'Academic', icon: 'book' },
    { match: /^Company/i, name: 'Official Reports', icon: 'doc' },
    { match: /^I have not formed/i, name: 'Still Deciding', icon: 'question' },
  ],
};
