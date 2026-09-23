/*
 * facts.js - evidence the games compare the survey against.
 * Every number has a source and URL. Checked 22 Sep 2026.
 * "confidence": high = official statistics / regulator / IEA; medium = reputable secondary reporting;
 * low = single estimate or contested method (games must show the caveat).
 * News items are PARAPHRASED claims (not verbatim headlines), attributed to the outlet.
 */
window.DC_FACTS = {
  checked: '2026-09-22',

  // CSO: data centres' share of Ireland's metered electricity (Republic of Ireland only).
  csoSeries: {
    source: 'Central Statistics Office (CSO), Data Centres Metered Electricity Consumption 2025',
    url: 'https://www.cso.ie/en/releasesandpublications/ep/p-dcmec/datacentresmeteredelectricityconsumption2025/keyfindings/',
    years: [
      { year: 2015, pct: 5, gwh: 1240 },
      { year: 2016, pct: 6, gwh: 1482 },
      { year: 2017, pct: 7, gwh: 1762 },
      { year: 2018, pct: 8, gwh: 2182 },
      { year: 2019, pct: 9, gwh: 2490 },
      { year: 2020, pct: 11, gwh: 3030 },
      { year: 2021, pct: 14, gwh: 4012 },
      { year: 2022, pct: 18, gwh: 5273 },
      { year: 2023, pct: 21, gwh: 6339 },
      { year: 2024, pct: 22, gwh: 6973 },
      { year: 2025, pct: 23, gwh: 7663 },
    ],
    // 2025 comparison from the same release
    compare2025: { dataCentres: 23, allHomes: 28, urbanHomes: 18, ruralHomes: 9 },
  },

  // Answer key for the survey's eight true/false belief items (q18-q25).
  trueFalse: {
    q18: {
      statement: 'All data centres in Ireland run on fossil fuels',
      verdict: 'false',
      tag: 'False',
      short: 'They run on the national grid, and about 41% of Irish electricity was renewable in 2024.',
      explain:
        'Data centres draw power from the same grid as everyone else. Renewables supplied 41.3% of Irish electricity in 2024 (SEAI), and many operators also buy wind power through contracts - Microsoft alone has signed 900 MW. The rest of the grid is still mostly gas, and backup generators burn diesel or gas, so "all fossil" is wrong but "all green" would be wrong too.',
      sources: [
        { label: 'SEAI - Renewables statistics (RES-E 41.3% in 2024)', url: 'https://www.seai.ie/data-and-insights/seai-statistics/renewables' },
        { label: 'DCD - Microsoft signs 900 MW of Irish PPAs', url: 'https://www.datacenterdynamics.com/en/news/microsoft-signs-900mw-ppas-for-ireland-28-of-nations-target-for-2030/' },
      ],
    },
    q19: {
      statement: 'Data centres can use surplus wind energy that would otherwise be wasted',
      verdict: 'partly',
      tag: 'Partly true',
      short: '14% of available wind energy on the island was turned away in 2024 - but mostly for grid-stability reasons, not lack of demand.',
      explain:
        'EirGrid "dispatched down" 14.0% of available wind energy across the island in 2024. But 96% of that curtailment in the Republic happened because a minimum number of conventional power stations must stay on to keep the grid stable - extra demand from a data centre does not fix that on its own. Flexible data centres could soak up some surplus; it is possible, not automatic.',
      sources: [
        { label: 'EirGrid - Annual Renewable Constraint and Curtailment Report 2024', url: 'https://cms.eirgrid.ie/sites/default/files/publications/Annual-Renewable-Constraint-and-Curtailment-Report-2024-V1.0.pdf' },
      ],
    },
    q20: {
      statement: 'Data centres can redirect waste heat to nearby homes and businesses',
      verdict: 'true',
      tag: 'True',
      short: 'Tallaght District Heating Scheme is heated by waste heat from an AWS data centre.',
      explain:
        'Since 2023 the Tallaght District Heating Scheme in South Dublin has used waste heat from an Amazon Web Services data centre to warm County Hall, the TU Dublin Tallaght campus and new apartments, cutting about 1,500 tonnes of CO2 a year. It is still rare: most Irish data centres do not export their heat.',
      sources: [
        { label: 'SEAI case study - Tallaght District Heating', url: 'https://www.seai.ie/case-studies/tallaght-district-heating' },
      ],
    },
    q21: {
      statement: 'Data centres are major employers in the communities where they are built',
      verdict: 'partly',
      tag: 'Missing context',
      short: 'Most jobs are temporary construction jobs; permanent operational jobs are far fewer.',
      explain:
        'A KPMG report for the Department of Enterprise (March 2026) links about 19,500 jobs in 2024 to building and running data centres - but only about 8,500 of those come from operations. Construction jobs are expected to fall to zero by 2030 if no new grid connections are agreed. In the UK, an analysis of 20 planned sites found about 1.2 permanent jobs per megawatt.',
      sources: [
        { label: 'KPMG for DETE - The value of data centres to Ireland (2026)', url: 'https://enterprise.gov.ie/en/publications/publication-files/the-value-of-data-centres-to-ireland.pdf' },
        { label: 'CNBC - AI data centres and jobs (Sept 2026)', url: 'https://www.cnbc.com/2026/09/09/ai-data-centers-jobs-tech-buildout.html' },
      ],
    },
    q22: {
      statement: 'Sustainable data centres must meet strict EU energy efficiency regulations by 2030',
      verdict: 'partly',
      tag: 'Mostly false',
      short: 'EU rules require reporting, not strict limits. Binding efficiency limits exist in Germany, not EU-wide.',
      explain:
        'Under the EU Energy Efficiency Directive, data centres of 500 kW or more must report their energy use, efficiency (PUE), water use and renewable share every year. The 2024 EU regulation sets no minimum performance standards; a rating scheme was still being drafted in 2026. Germany has gone further with binding efficiency limits (PUE 1.2 for new sites from July 2026).',
      sources: [
        { label: 'White & Case - EU data centre rules and outlook for 2026', url: 'https://www.whitecase.com/insight-alert/data-centres-and-energy-consumption-evolving-eu-regulatory-landscape-and-outlook-2026' },
        { label: 'White & Case - German Energy Efficiency Act requirements', url: 'https://www.whitecase.com/insight-alert/data-center-requirements-under-new-german-energy-efficiency-act' },
      ],
    },
    q23: {
      statement: "Ireland's cool, rainy climate makes it particularly well-suited to hosting data centres",
      verdict: 'true',
      tag: 'True',
      short: 'Cool air means cheaper cooling - one of several reasons, alongside tax, EU access and subsea cables.',
      explain:
        'A mild, cool climate lets data centres use outside air for cooling for much of the year, which saves energy. It is one reason among several: the Oireachtas research service also points to EU market access, connectivity, an English-speaking workforce and the corporate tax environment.',
      sources: [
        { label: 'Oireachtas Library & Research Service - The future of data centres in Ireland (2025)', url: 'https://data.oireachtas.ie/ie/oireachtas/libraryResearch/2025/2025-03-20_the-future-of-data-centres-in-ireland_en.pdf' },
      ],
    },
    q24: {
      statement: "Data centres are responsible for a significant proportion of Ireland's total electricity use",
      verdict: 'true',
      tag: 'True',
      short: '23% of metered electricity in 2025 - more than all urban homes combined (18%).',
      explain:
        "The CSO measured data centres at 23% of Ireland's metered electricity in 2025, up from 5% in 2015. That is more than every urban household in the country combined (18%). The regulator projects 31% by 2034.",
      sources: [
        { label: 'CSO - Data Centres Metered Electricity Consumption 2025', url: 'https://www.cso.ie/en/releasesandpublications/ep/p-dcmec/datacentresmeteredelectricityconsumption2025/keyfindings/' },
        { label: 'CRU - Decision on connection policy for data centres', url: 'https://www.cru.ie/about-us/news/the-cru-publishes-its-decision-on-new-electricity-connection-policy-for-data-centres/' },
      ],
    },
    q25: {
      statement: 'AI-assisted data centres can adjust their workload based on available renewable energy',
      verdict: 'true',
      tag: 'True',
      short: 'Google has shifted flexible computing to cleaner hours and places since 2020.',
      explain:
        "Google's carbon-intelligent computing platform (2020) moves flexible jobs - like processing uploaded videos - to times and locations with more carbon-free electricity. It works for tasks that can wait; it does not apply to everything, like a live search or a video call.",
      sources: [
        { label: 'DCD - Google shifts moveable compute to use renewable energy', url: 'https://www.datacenterdynamics.com/en/news/google-shifts-moveable-compute-tasks-between-data-centers-to-use-regional-renewable-energy/' },
      ],
    },
  },

  // Key numbers (use these instead of inventing any).
  facts: [
    { id: 'ie-share-2025', topic: 'electricity', text: "Data centres used 23% of Ireland's metered electricity in 2025 (5% in 2015).", source: 'CSO', year: 2025, url: 'https://www.cso.ie/en/releasesandpublications/ep/p-dcmec/datacentresmeteredelectricityconsumption2025/keyfindings/', confidence: 'high' },
    { id: 'ie-share-2034', topic: 'electricity', text: 'The energy regulator projects data centres at 31% of national electricity demand by 2034 (22% in 2024).', source: 'CRU', year: 2025, url: 'https://www.cru.ie/about-us/news/the-cru-publishes-its-decision-on-new-electricity-connection-policy-for-data-centres/', confidence: 'high' },
    { id: 'ie-rese', topic: 'electricity', text: "Renewables supplied 41.3% of Ireland's electricity in 2024; the 2030 target is 80%.", source: 'SEAI', year: 2024, url: 'https://www.seai.ie/data-and-insights/seai-statistics/renewables', confidence: 'high' },
    { id: 'ie-wind-dd', topic: 'electricity', text: 'In 2024, 14.0% of available wind energy on the island of Ireland was dispatched down (not used).', source: 'EirGrid', year: 2024, url: 'https://cms.eirgrid.ie/sites/default/files/publications/Annual-Renewable-Constraint-and-Curtailment-Report-2024-V1.0.pdf', confidence: 'high' },
    { id: 'ie-cru-2025', topic: 'policy', text: 'Since December 2025, new large data centres must match at least 80% of their yearly demand with new Irish renewables within 6 years, and bring on-site generation that can support the grid.', source: 'CRU via RTÉ', year: 2025, url: 'https://www.rte.ie/news/business/2025/1212/1548674-80-of-data-centre-energy-must-come-from-renewables-cru/', confidence: 'high' },
    { id: 'ie-moratorium', topic: 'policy', text: 'From 2021, the grid operator effectively stopped new data-centre connections in the Dublin region.', source: 'Pinsent Masons', year: 2021, url: 'https://www.pinsentmasons.com/out-law/news/irish-data-centres-power-national-grid-regulator', confidence: 'high' },
    { id: 'ie-water', topic: 'water', text: "Data centres on the public water network use under 0.3% of the drinking water Uisce Éireann supplies - but use nearly doubled in the dry July of 2026 (over 200 million litres that month).", source: 'Uisce Éireann via TheJournal.ie', year: 2026, url: 'https://www.thejournal.ie/ireland-data-centre-water-use-7137959-Aug2026/', confidence: 'medium' },
    { id: 'ie-jobs', topic: 'economy', text: 'About 19,500 jobs were linked to building and running data centres in 2024; about 8,500 of them come from operations. Construction jobs are projected to fall to zero by 2030 without new grid connections.', source: 'KPMG for DETE (2026)', year: 2024, url: 'https://enterprise.gov.ie/en/publications/publication-files/the-value-of-data-centres-to-ireland.pdf', confidence: 'medium' },
    { id: 'ie-gva', topic: 'economy', text: 'In 2024 data centres in Ireland underpinned about €2.2bn in gross value added and €280m in employment-related tax.', source: 'KPMG for DETE (2026)', year: 2024, url: 'https://enterprise.gov.ie/en/publications/publication-files/the-value-of-data-centres-to-ireland.pdf', confidence: 'medium' },
    { id: 'ie-count', topic: 'economy', text: 'How many data centres does Ireland have? 72 operational buildings (KPMG, 2025), 82 (industry, 2024) or about 121 (Oireachtas research, 2025) - it depends on what you count.', source: 'KPMG / Mitchell McDermott / Oireachtas', year: 2025, url: 'https://www.oireachtas.ie/en/how-parliament-is-run/houses-of-the-oireachtas-service/library-and-research-service/research-matters/2025-03-20-the-future-of-data-centres-in-ireland/', confidence: 'medium' },
    { id: 'ie-tallaght', topic: 'heat', text: 'Tallaght District Heating Scheme runs on waste heat from an AWS data centre and saves about 1,500 tonnes of CO2 a year.', source: 'SEAI', year: 2023, url: 'https://www.seai.ie/case-studies/tallaght-district-heating', confidence: 'high' },
    { id: 'ie-bills', topic: 'economy', text: 'A report commissioned by Friends of the Earth estimates each Irish household paid about €360 extra for electricity in 2015-2023 because of data-centre demand. This is modelling by an advocacy group, not an official figure.', source: 'Friends of the Earth Ireland', year: 2025, url: 'https://www.friendsoftheearth.ie/news/the-cost-of-data-centre-growth-in-ireland-households-paid-an-estimated-715-million-more-in-electrici/', confidence: 'low' },
    { id: 'global-2024', topic: 'global', text: "Data centres used about 415 TWh worldwide in 2024 - roughly 1.5% of the world's electricity.", source: 'IEA, Energy and AI', year: 2024, url: 'https://www.iea.org/reports/energy-and-ai/energy-demand-from-ai', confidence: 'high' },
    { id: 'global-2030', topic: 'global', text: 'The IEA expects global data-centre electricity use to roughly double to about 950 TWh by 2030 (about 3% of world demand).', source: 'IEA, Energy and AI', year: 2026, url: 'https://www.iea.org/reports/energy-and-ai/energy-demand-from-ai', confidence: 'high' },
    { id: 'us-share', topic: 'global', text: 'US data centres used about 4.4% of US electricity in 2023.', source: 'Lawrence Berkeley National Laboratory', year: 2023, url: 'https://eta-publications.lbl.gov/sites/default/files/2024-12/lbnl-2024-united-states-data-center-energy-usage-report_1.pdf', confidence: 'high' },
    { id: 'prompt-gemini', topic: 'per-use', text: 'Google measured a median Gemini text prompt at 0.24 Wh of electricity and 0.26 mL of water (company-published, text prompts only).', source: 'Google, Aug 2025', year: 2025, url: 'https://arxiv.org/pdf/2508.15734', confidence: 'medium' },
    { id: 'prompt-chatgpt', topic: 'per-use', text: 'Epoch AI estimates a typical ChatGPT query at about 0.3 Wh - ten times less than an older, widely repeated 3 Wh figure.', source: 'Epoch AI', year: 2025, url: 'https://epoch.ai/gradient-updates/how-much-energy-does-chatgpt-use', confidence: 'low' },
    { id: 'streaming', topic: 'per-use', text: 'One hour of video streaming produced about 36 g of CO2 (2019), not the 82 g figure that went viral - the IEA found the original estimate far too high.', source: 'IEA', year: 2020, url: 'https://www.iea.org/commentaries/the-carbon-footprint-of-streaming-video-fact-checking-the-headlines', confidence: 'high' },
  ],

  // How other places handled data-centre growth.
  policies: [
    { place: 'Ireland', year: '2021-2025', approach: 'Pause, then conditions', detail: 'Dublin grid connections effectively paused from 2021; reopened in Dec 2025 on condition of 80% new renewables within 6 years and on-site generation.', url: 'https://www.rte.ie/news/business/2025/1212/1548674-80-of-data-centre-energy-must-come-from-renewables-cru/' },
    { place: 'Amsterdam', year: '2019 / 2025', approach: 'Moratorium, then cap', detail: 'A one-year ban on new data centres in 2019; in 2025 the city decided to allow no new data centres or expansions.', url: 'https://nltimes.nl/2025/04/18/amsterdam-allowing-data-centers-municipality' },
    { place: 'Netherlands', year: '2024', approach: 'Hyperscale ban', detail: 'No new hyperscale data centres (over 10 hectares and 70 MW) anywhere except two northern municipalities.', url: 'https://www.lexology.com/library/detail.aspx?g=860e6650-6ae7-48ca-b591-4fed6e864784' },
    { place: 'Singapore', year: '2019-2022', approach: 'Moratorium, then green criteria', detail: 'Paused new data centres when they reached ~7% of national electricity; reopened in 2022 for a small amount of capacity with strict efficiency (PUE 1.3 or better) and green-building rules.', url: 'https://www.lexology.com/library/detail.aspx?g=254ea4fc-98b1-465f-9904-2f4c4c3496fc' },
    { place: 'Germany', year: '2023-2028', approach: 'Efficiency law', detail: 'Energy Efficiency Act: new data centres from July 2026 must reach PUE 1.2 and reuse 10% of waste heat, rising to 20% by 2028.', url: 'https://www.whitecase.com/insight-alert/data-center-requirements-under-new-german-energy-efficiency-act' },
    { place: 'Denmark', year: '2026-2028', approach: 'Heat for homes', detail: 'New data centres near Copenhagen are being connected to district heating to warm thousands of homes (about 6,000 from one Microsoft site).', url: 'https://local.microsoft.com/blog/datacenter_heat_repurposed/' },
    { place: 'Virginia, USA', year: '2023-2025', approach: 'Rapid growth', detail: "Data centres made up about a quarter of the main utility's Virginia electricity sales; local support for new data centres has since fallen sharply.", url: 'https://www.tomshardware.com/tech-industry/virginia-voter-support-for-new-data-centers-collapses-to-35-percent' },
    { place: 'European Union', year: '2024-2026', approach: 'Transparency first', detail: 'Data centres of 500 kW+ must publicly report energy, efficiency, water and renewable use every year; a rating label is being drafted.', url: 'https://www.whitecase.com/insight-alert/data-centres-and-energy-consumption-evolving-eu-regulatory-landscape-and-outlook-2026' },
  ],

  // Paraphrased news claims with a verdict against the best evidence.
  // verdict: supported | mostly_supported | missing_context | misleading | unsupported | opinion
  claims: [
    { id: 'c1', outlet: 'RTÉ News', date: 'Jul 2026', topic: 'electricity', claim: "Data centres now use almost a quarter of Ireland's electricity.", verdict: 'supported', evidence: 'CSO: 23% of metered electricity in 2025, up from 22% in 2024 and 5% in 2015.', missing: "It is the Republic only, and a national average hides how concentrated the load is around Dublin.", url: 'https://www.rte.ie/news/business/2026/0707/1582175-cso-data-centre-energy-figures/' },
    { id: 'c2', outlet: 'The Irish Times', date: 'Apr 2026', topic: 'electricity', claim: 'Fear of blackouts forces new rules on data centres.', verdict: 'mostly_supported', evidence: 'EirGrid proposed new grid-code rules in April 2026 so data centres stay connected during brief grid faults instead of all switching to backup at once.', missing: 'The rules are preventive. "Blackout fear" makes it sound like an outage is imminent; the documented risk is a technical scenario.', url: 'https://www.irishtimes.com/environment/2026/04/02/data-centres-blackout-worries-trigger-new-electricity-protocols/' },
    { id: 'c3', outlet: 'The Irish Times', date: 'Oct 2025', topic: 'policy', claim: 'Data centres worth €5.6bn have planning permission but no electricity.', verdict: 'missing_context', evidence: 'The Dublin connection pause from 2021 was real; the regulator reopened connections in Dec 2025 with renewable conditions.', missing: 'The €5.6bn is an industry estimate, and the pause existed for grid-stability reasons.', url: 'https://www.irishtimes.com/ireland/2025/10/13/data-centres-costing-56bn-have-planning-approval-but-no-power-industry-warns/' },
    { id: 'c4', outlet: 'Energy Connects', date: 'Dec 2025', topic: 'policy', claim: 'Ireland ends its freeze on new data-centre grid connections.', verdict: 'supported', evidence: 'CRU decision, Dec 2025: connections resume if new data centres reach 80% renewables within 6 years and bring on-site generation.', missing: 'It is a conditional reopening, and enforcement details are still being worked out.', url: 'https://www.energyconnects.com/news/utilities/2025/december/ireland-ends-moratorium-on-new-power-links-to-data-centers/' },
    { id: 'c5', outlet: 'TheJournal.ie', date: 'Aug 2026', topic: 'water', claim: 'Data-centre water use almost doubled during the hot summer.', verdict: 'supported', evidence: 'Uisce Éireann: over 200 million litres in July 2026, about what 50,000 people use.', missing: 'Across the year data centres use under 0.3% of public drinking water - and private wells are not counted at all.', url: 'https://www.thejournal.ie/ireland-data-centre-water-use-7137959-Aug2026/' },
    { id: 'c6', outlet: 'BizWorld Ireland', date: 'Jun 2026', topic: 'economy', claim: 'Ireland has 107 data centres and €18.5bn of investment.', verdict: 'missing_context', evidence: 'Other counts: 72 operational buildings (KPMG for the government, 2025) or about 121 (Oireachtas research, 2025).', missing: 'Each source counts differently - so the number depends on the definition.', url: 'https://bizworldireland.ie/2026/06/26/ireland-data-centre-sector-107-facilities-18-5-billion-investment/' },
    { id: 'c7', outlet: 'The Irish Times', date: 'Apr 2023', topic: 'heat', claim: 'Waste heat from a Dublin data centre now warms local buildings.', verdict: 'supported', evidence: 'Tallaght District Heating Scheme uses AWS waste heat and saves about 1,500 t CO2 a year.', missing: 'It is one scheme; most Irish data centres still release their heat unused.', url: 'https://www.irishtimes.com/environment/climate-crisis/2023/04/06/excess-heat-from-dublin-data-centre-to-warm-local-buildings-in-first-for-ireland/' },
    { id: 'c8', outlet: 'TheJournal.ie', date: 'Aug 2026', topic: 'community', claim: 'US backlash against data centres could push investment to Ireland.', verdict: 'unsupported', evidence: 'US opposition is real (Virginia support fell from 69% to 35%), but no investment data shows money moving to Ireland.', missing: 'It is informed speculation, not a measured trend.', url: 'https://www.thejournal.ie/data-centres-ireland-us-7142470-Aug2026/' },
    { id: 'c9', outlet: 'E&T Magazine', date: 'May 2026', topic: 'electricity', claim: 'UK and US data centres now use around 6% of national electricity.', verdict: 'missing_context', evidence: 'Berkeley Lab put the US at 4.4% (2023) to 4.7% (2024); UK estimates are lower, around 2.6%.', missing: 'No year, scope or method is given, so the 6% cannot be checked.', url: 'https://eandt.theiet.org/2026/05/15/uk-and-us-data-centres-now-consume-around-6-national-electricity' },
    { id: 'c10', outlet: 'CNBC', date: 'Sep 2026', topic: 'economy', claim: 'AI data centres will create far fewer jobs than the industry promised.', verdict: 'supported', evidence: 'An analysis of 20 UK sites found about 1.2 operational jobs per MW, against the 8.5 per MW the industry assumed.', missing: 'The industry disputes the method, and construction jobs (temporary) are not counted.', url: 'https://www.cnbc.com/2026/09/09/ai-data-centers-jobs-tech-buildout.html' },
    { id: 'c11', outlet: 'Newsweek', date: 'Aug 2026', topic: 'electricity', claim: 'A map shows AI data centres driving up power prices in every US state.', verdict: 'misleading', evidence: 'Data-centre demand is raising costs in specific grid regions (PJM projects a $6.3bn rise over three years).', missing: 'Putting all 50 states under one cause ignores fuel prices, weather and local factors.', url: 'https://www.newsweek.com/map-shows-electricity-costs-in-every-state-as-ai-data-centers-surge-prices-12279072' },
    { id: 'c12', outlet: 'E&T Magazine', date: 'Apr 2026', topic: 'ai', claim: 'AI data-centre electricity use will triple by 2030.', verdict: 'mostly_supported', evidence: 'IEA: AI-focused data centres roughly triple; all data centres together roughly double to about 950 TWh.', missing: '"Triple" applies to the AI subset, not to all data centres.', url: 'https://eandt.theiet.org/2026/04/22/iea-warns-ai-data-centre-electricity-use-will-triple-2030' },
    { id: 'c13', outlet: 'Widely shared in 2019', date: '2019', topic: 'per-use', claim: 'Watching 30 minutes of Netflix emits as much CO2 as driving 6 km.', verdict: 'misleading', evidence: 'The IEA re-checked the maths: one hour of streaming was about 36 g CO2, many times less than the viral figure.', missing: 'The original estimate overstated data-centre and network energy.', url: 'https://www.iea.org/commentaries/the-carbon-footprint-of-streaming-video-fact-checking-the-headlines' },
    { id: 'c14', outlet: 'CNBC', date: 'Jan 2025', topic: 'economy', claim: 'The $500bn Stargate AI project will create 100,000 jobs.', verdict: 'missing_context', evidence: 'The investment commitments are confirmed; later reporting found permanent staff per site in the dozens.', missing: 'The jobs figure mixed temporary construction work with permanent jobs.', url: 'https://www.cnbc.com/2025/01/21/trump-ai-openai-oracle-softbank.html' },
    { id: 'c15', outlet: 'FactCheckNI', date: '2026', topic: 'electricity', claim: "Ireland's data centres use nearly a quarter of the island's electricity.", verdict: 'missing_context', evidence: 'The CSO figure (22-23%) covers the Republic of Ireland only.', missing: 'Northern Ireland has a separate electricity market and is not in the figure.', url: 'https://factcheckni.org/articles/energy-on-this-island-do-irelands-data-centres-now-consume-nearly-a-quarter-of-all-electricity-in-the-south/' },
    { id: 'c16', outlet: 'Fortune', date: 'Jul 2026', topic: 'carbon', claim: "Microsoft's emissions rose 25% in 2025 as it built AI data centres.", verdict: 'supported', evidence: "Microsoft's own report: about 16 to 20 million tonnes CO2e, blamed on data-centre expansion.", missing: 'Microsoft still says it aims to be carbon negative by 2030.', url: 'https://fortune.com/2026/07/09/microsoft-carbon-emissions-2025-data-centers/' },
    { id: 'c17', outlet: 'Friends of the Earth Ireland', date: '2025', topic: 'economy', claim: 'Households paid €715m more for electricity because of data centres.', verdict: 'opinion', evidence: 'An economic model commissioned by an advocacy group; the government-commissioned KPMG report counts €2.2bn a year of economic value instead.', missing: 'Neither side is an official cost-benefit account - each models what it set out to measure.', url: 'https://www.friendsoftheearth.ie/news/the-cost-of-data-centre-growth-in-ireland-households-paid-an-estimated-715-million-more-in-electrici/' },
    { id: 'c18', outlet: 'Data Centre Review', date: 'Jul 2026', topic: 'community', claim: 'Over 1,200 objections lodged against a £5bn data centre next to a Scottish village.', verdict: 'supported', evidence: "Fife Council's planning portal recorded more than 1,200 objections to the 600 MW proposal near a village of about 250 people.", missing: 'Objection counts show strength of feeling, not what the wider area thinks.', url: 'https://datacentrereview.com/2026/07/more-than-1200-objections-lodged-against-5bn-fife-data-centre/' },
  ],
};
