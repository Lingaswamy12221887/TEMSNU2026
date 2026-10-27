// Default content for the ICICSE 2027 site. Used on first run and by "Reset to defaults".
// Committee, fee and date data come from the supplied Excel sheet.
let n = 0;
const id = () => 's' + (++n).toString(36);

const rich = (title, html, anchor) => ({ id: id(), type: 'richtext', title, html, anchor: anchor || '' });
const cards = (title, items, cols, intro) => ({ id: id(), type: 'cards', title, intro: intro || '', cols: cols || 3, center: false, items });
const table = (title, intro, columns, rows, note) => ({ id: id(), type: 'table', title, intro: intro || '', columns, rows, note: note || '' });

function simplePage(title, intro, extra) {
  return { title, sections: [rich(title, '<p>' + intro + '</p>' + (extra || '')) ] };
}
const soon = 'Details for this programme will be announced shortly. Please check back soon.';

module.exports = function seed() {
  n = 0;

  const dates = [
    ['Open Manuscript Submissions', '1 Jan 2027'],
    ['Close Manuscript Submissions', '10 Aug 2027'],
    ['Notification of Acceptance of Manuscripts', '9 Sep 2027'],
    ['Open Submission of Special Session / Workshop / Tutorials', '1 Jan 2027'],
    ['Close Submission of Special Session / Workshop / Tutorials', '31 Mar 2027'],
    ['Notification of Acceptance of Special Session / Workshop / Tutorials', '1 Apr 2027'],
    ['Early Bird Registration Starts', '10 Sep 2027'],
    ['Early Bird Registration Closes', '1 Nov 2027'],
    ['Camera Ready Paper Submission', '1 Nov 2027'],
    ['Closure of All Registrations', '20 Nov 2027'],
    ['Conference Dates', '10 – 11 Dec 2027 (tentative)']
  ];

  const fees = [
    ['Indian Author (Academia) Presenter', '₹6,500', '₹7,500', '₹7,500', '₹8,000'],
    ['Indian Author (Industry) Presenter', '₹8,000', '₹9,000', '₹9,000', '₹10,000'],
    ['Indian Author (Student, first author) Presenter', '₹4,000', '₹4,500', '₹5,000', '₹6,000'],
    ['Indian Non-Author Attendee (Non-Presenter)', '₹4,000', '₹5,000', '₹6,000', '₹7,000'],
    ['Additional Author Registration', '₹3,000', '₹4,000', '₹4,000', '₹5,000'],
    ['Indian Author Additional Paper Rate*', '₹2,000 / paper', '₹2,000 / paper', '₹3,000 / paper', '₹3,000 / paper'],
    ['Non-Indian Author Registration', 'USD 150', 'USD 150', 'USD 200', 'USD 200']
  ];

  const m = (name, details, phone, email, label) => ({ label: label || '', name, details: details || '', phone: phone || '', email: email || '' });
  const committee = [
    { role: 'General Chair', members: [
      m('K. Mohan Raidu', 'Chairperson, IEEE CS Hyd. Sec.'),
      m('Dr. Karthikeyan M', 'SMIEEE, Former Chair, IEEE Podhigai Sub-Section of Madras Section, Dean, School of Engineering, SUH')] },
    { role: 'Program Chairs', members: [
      m('N. Sabitha', 'SBC, IEEE SUH, Hyderabad')] },
    { role: 'Organizing Chair', members: [
      m('Dr. B. Saritha', 'Prof. CSE, SUH, SMIEEE, Treasurer IEEE-CS Hyderabad Section')] },
    { role: 'Organizing Co-Chair', members: [
      m('Dr. Kumaraswamy', 'HoD-CSE-AIML')] },
    { role: 'Registration Committee Chair', members: [
      m('Dr. Padmaja', 'HOD, CSE')] },
    { role: 'Technical Program Chair', members: [
      m('Prof. S. Lakshminarayana', 'Chair, IEEE Vizag Bay Section')] },
    { role: 'Finance Committee Chair', members: [
      m('To be announced')] },
    { role: 'Publication Chair', members: [
      m('To be announced')] }
  ];

  const title = 'IEEE International Conference on Intelligent, Connected and Sustainable Engineering (ICICSE 2027)';
  const theme = 'Engineering Innovation at Scale for a Connected, Intelligent, Secure and Sustainable Future';
  const vision = 'Advancing emerging technologies and engineering innovation toward connected, private, secure, intelligent and sustainable applications and systems with real-world and population-scale impact.';

  const pages = {};

  /* ---------------- HOME ---------------- */
  pages[''] = {
    title: 'Home',
    sections: [
      { id: id(), type: 'hero', slides: [
        { title: theme, text: 'Intelligent, connected, secure and sustainable engineering with population-scale impact.', btnLabel: 'READ THEME', btnHref: '#theme', image: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRnYDIktd8aqdC8l_Bzg6eDodlzAte0VMQxkH0pYW2zIg&s=10' },
        { title: 'Call for Papers Open!', text: 'Original research papers and impactful project contributions are invited from researchers worldwide.', btnLabel: 'SUBMIT PAPER', btnHref: '/call-for-papers', image: 'https://commons.wikimedia.org/wiki/Special:FilePath/Charminar-Pride_of_Hyderabad.jpg?width=1600' },
        { title: 'Explore Hyderabad', text: 'Hyderabad, the "City of Pearls" and "City of Nizams", blends rich 16th-century history with a modern, techno-savvy metropolis.', btnLabel: 'Explore', btnHref: '/places', image: 'https://commons.wikimedia.org/wiki/Special:FilePath/Golconda_Fort_Hyderabad_315.jpg?width=1600' },
        { title: 'Bridging Innovation, Engineering & Impact for a Better Tomorrow', text: 'HITEC City, Hyderabad', btnLabel: '', btnHref: '', image: 'https://commons.wikimedia.org/wiki/Special:FilePath/Cyber_Towers,_Hitech_city,_Hyderabad.jpg?width=1600' }
      ] },
      { id: id(), type: 'countdown' },
      rich('Conference Theme & Vision',
        '<p class="lead-strong">Theme: ' + theme + '</p>' +
        '<h3>Conference Vision</h3><p>' + vision + '</p>' +
        '<p>ICICSE 2027 provides a multidisciplinary platform for researchers, scientists, engineers, academicians, industry leaders and students to exchange ideas, showcase emerging technologies and present original research that addresses the connected, intelligent, secure and sustainable systems of the future.</p>', 'theme'),
      rich('About ICICSE 2027',
        '<p>The <strong>IEEE International Conference on Intelligent, Connected and Sustainable Engineering (ICICSE 2027)</strong> is financially sponsored by the <strong>IEEE CS Hyderabad Section</strong> and <strong>Sreenidhi University</strong>.</p>' +
        '<p>The conference invites original research, case studies and innovative solutions that present interdisciplinary approaches, novel frameworks, implementation models and best practices for engineering innovation at scale.</p>' +
        '<h3>Attendees will benefit from a programme featuring:</h3>' +
        '<ul><li>Keynote and plenary sessions by distinguished experts</li>' +
        '<li>Invited talks and panel discussions on intelligent, connected, secure and sustainable systems</li>' +
        '<li>Presentation of high-quality research papers selected through peer review</li>' +
        '<li>Networking opportunities for academicians, researchers, industry leaders, students and practitioners</li></ul>'),
      rich('About the Host: Sreenidhi University',
        '<p><strong>Sreenidhi University (SUH)</strong> hosts ICICSE 2027 at its campus, with financial sponsorship from the <strong>IEEE Computer Society Hyderabad Section</strong>. The School of Engineering, together with the IEEE SUH Student Branch Chapter, leads the organising effort.</p>'),
      table('Key Dates', '', ['Milestone', 'Date'], [
        ['Close Manuscript Submissions', '10 Aug 2027'],
        ['Notification of Acceptance', '9 Sep 2027'],
        ['Camera Ready Paper Submission', '1 Nov 2027'],
        ['Conference Dates', '10 – 11 Dec 2027 (tentative)']
      ], 'See the Important Dates page for the full schedule.'),
      cards('Conference Structure', [
        { icon: 'fa-solid fa-microphone-lines', title: 'Keynote Talks', text: 'Delivered by recognised experts in intelligent systems, connectivity, security and sustainable engineering, offering insights aligned with the conference theme.' },
        { icon: 'fa-solid fa-users-line', title: 'Panel Discussions', text: 'Engaging dialogues on contemporary issues, including trustworthy AI, secure and private systems, and sustainable innovation at scale.' },
        { icon: 'fa-solid fa-file-lines', title: 'Technical Sessions', text: 'Tracks featuring high-quality research papers and case studies on emerging technologies and interdisciplinary engineering innovation.' },
        { icon: 'fa-solid fa-screwdriver-wrench', title: 'Workshops & Tutorials', text: 'Hands-on, skill-building sessions that let participants explore tools, methods and frameworks through practical exercises.' },
        { icon: 'fa-solid fa-chart-area', title: 'Poster Sessions', text: 'A platform for researchers, innovators and students to present preliminary findings, concept demonstrations and ongoing work.' },
        { icon: 'fa-solid fa-handshake', title: 'Networking Events', text: 'Curated networking opportunities fostering collaboration between academia, industry, startups and research organisations.' }
      ], 3),
      cards('Potential Speakers', [
        { icon: 'fa-solid fa-building', title: 'Industry Leaders', text: 'CEOs, CTOs, innovation officers and senior technology executives sharing insights on intelligent systems, digital transformation and sustainable growth.' },
        { icon: 'fa-solid fa-graduation-cap', title: 'Academicians & Researchers', text: 'Professors, scientists and scholars from premier universities and research institutions across engineering disciplines.' },
        { icon: 'fa-solid fa-scale-balanced', title: 'Government Representatives', text: 'Policymakers and officials involved in technology governance and initiatives supporting secure and sustainable development.' },
        { icon: 'fa-solid fa-rocket', title: 'Entrepreneurs', text: 'Startup founders and emerging technology leaders building next-generation products and platforms.' }
      ], 2),
      { id: id(), type: 'program', title: 'Conference Program', intro: 'Two days of presentations, workshops and networking designed to advance connected, intelligent and sustainable engineering. The programme below is tentative.', days: [
        { title: 'Day 1: Intelligent & Connected Systems', date: '10 December 2027', items: [
          { time: '9:00 AM', title: 'Registration & Welcome Coffee', speaker: '' },
          { time: '10:00 AM', title: 'Inauguration', speaker: '' },
          { time: '10:45 AM', title: 'Keynote Address', speaker: 'To be announced' },
          { time: '12:00 PM', title: 'Technical Session 1', speaker: '' },
          { time: '1:00 PM', title: 'Networking Lunch', speaker: '' },
          { time: '2:30 PM', title: 'Panel Discussion', speaker: '' },
          { time: '4:00 PM', title: 'Poster Session & Coffee Break', speaker: '' }
        ] },
        { title: 'Day 2: Secure & Sustainable Engineering', date: '11 December 2027', items: [
          { time: '9:00 AM', title: 'Coffee & Networking', speaker: '' },
          { time: '9:30 AM', title: 'Keynote Address', speaker: 'To be announced' },
          { time: '10:45 AM', title: 'Technical Session 2', speaker: '' },
          { time: '12:00 PM', title: 'Workshop / Tutorial', speaker: '' },
          { time: '1:00 PM', title: 'Lunch Break', speaker: '' },
          { time: '2:30 PM', title: 'Technical Session 3', speaker: '' },
          { time: '4:00 PM', title: 'Best Paper Awards & Valedictory', speaker: '' }
        ] }
      ] }
    ]
  };

  /* ---------------- CORE PAGES ---------------- */
  pages['committee'] = { title: 'Committee', sections: [{ id: id(), type: 'committee', title: 'Organizing Committee (ICICSE 2027)', groups: committee }] };

  pages['call-for-papers'] = { title: 'Call for Papers', sections: [
    rich('Call for Papers',
      '<p>Original, unpublished research papers and impactful project contributions are invited from researchers, academicians, industry professionals and students worldwide.</p>' +
      '<p><strong>Theme:</strong> ' + theme + '</p>' +
      '<h3>Topics of Interest</h3><ul>' +
      '<li>Artificial Intelligence, Machine Learning and Generative AI</li>' +
      '<li>Connected systems: IoT, edge computing, 5G/6G and communication networks</li>' +
      '<li>Cybersecurity, privacy and trustworthy computing</li>' +
      '<li>Sustainable and green engineering, energy and environment</li>' +
      '<li>Smart cities, smart infrastructure and cyber-physical systems</li>' +
      '<li>Data engineering, cloud and high-performance computing</li>' +
      '<li>Healthcare, agriculture and societal applications at population scale</li></ul>' +
      '<p>Accepted and presented papers will appear in the conference proceedings. Special session, workshop and tutorial proposals are also welcome.</p>')
  ] };

  pages['important-dates'] = { title: 'Important Dates', sections: [
    table('Important Dates', 'All dates are for the year 2027.', ['Milestone', 'Date'], dates, '')
  ] };

  pages['registration'] = { title: 'Registration', sections: [
    table('Registration', 'Registration rates for both virtual and physical participants (amounts in INR unless stated).',
      ['Category', 'Early Bird – IEEE', 'Early Bird – Non-IEEE', 'Regular – IEEE', 'Regular – Non-IEEE'], fees,
      '* Additional paper rate applies to each extra paper registered by the same author. Early bird registration: 10 Sep 2027 – 1 Nov 2027. All registrations close on 20 Nov 2027.'),
    rich('How to Register', '<p>Registration instructions and the payment link will be published here. For assistance, please use the details on the Contact Us page.</p>')
  ] };

  /* ---------------- AUTHORS ---------------- */
  pages['instructions-for-authors'] = { title: 'Instructions for Authors', sections: [
    rich('Instructions for Authors',
      '<ul><li>Submissions must be original and not under review elsewhere.</li>' +
      '<li>Prepare the manuscript using the official IEEE conference paper template (two-column format).</li>' +
      '<li>All submissions undergo a similarity check and a peer review.</li>' +
      '<li>Papers must be submitted through the conference submission portal before the deadline.</li>' +
      '<li>At least one author of every accepted paper must register and present the paper.</li></ul>')
  ] };
  pages['review-manuscripts'] = { title: 'Review Manuscripts', sections: [
    rich('Review of Manuscripts', '<p>Every manuscript is reviewed by members of the Technical Program Committee for originality, technical quality, relevance to the conference theme and clarity of presentation. Authors are notified of the decision by the acceptance date listed on the Important Dates page.</p>')
  ] };
  pages['camera-ready'] = { title: 'Camera Ready', sections: [
    rich('Camera-Ready Paper Instructions', '<p>Authors of accepted papers must incorporate reviewer feedback and submit the final camera-ready manuscript by the deadline on the Important Dates page, following the IEEE formatting guidelines.</p>')
  ] };

  /* ---------------- PROGRAMS ---------------- */
  const programPages = [
    ['invited-guests', 'Invited Guests'], ['plenary-talks', 'Plenary Talks'], ['keynotes', 'Keynotes'], ['speakers', 'Speakers'],
    ['workshops', 'Workshops'], ['tutorials', 'Tutorials'], ['industry-forum', 'Industry Forum'], ['mentoring-program', 'Mentoring Program'],
    ['pre-university-stem', 'Pre-University STEM Education'], ['startup-pitch', 'Startup Pitch Competition'], ['3mt-competition', '3MT Competition'],
    ['student-programs', 'All Student Programs'], ['project-expo', 'Project Expo'], ['poster-presentation', 'Poster Presentation Competition'],
    ['btech-innovation', 'B.Tech Innovation Initiative'], ['ideathon', 'Ideathon'], ['special-program', 'Special Program'],
    ['technical-sessions', 'Technical Sessions'], ['yp-programs', 'YP Programs'], ['wie-program', 'Women in Engineering Program']
  ];
  programPages.forEach(([slug, t]) => { pages[slug] = simplePage(t, soon); });

  /* ---------------- TRAVEL ---------------- */
pages['venue'] = simplePage(
  'Venue Information',
  'ICICSE 2027 will be held at <strong>Sreenidhi University</strong>, Hyderabad.',
  '<p><a href="https://maps.app.goo.gl/H8GPjNzbgWxHojsn9" target="_blank" rel="noopener">📍 Open in Google Maps</a></p>' +
  '<iframe src="https://maps.google.com/maps?q=17.4571986,78.6652322&z=15&output=embed" ' +
  'width="100%" height="420" style="border:0;border-radius:8px" loading="lazy" ' +
  'referrerpolicy="no-referrer-when-downgrade" allowfullscreen></iframe>'
);

  pages['sponsorship'] = simplePage('Sponsorships', 'ICICSE 2027 welcomes sponsors and exhibitors from industry and institutions who wish to support engineering research and innovation. Sponsorship packages will be published here; for early enquiries please use the Contact Us page.');
  pages['contact-us'] = { title: 'Contact Us', sections: [
    rich('Contact Us',
      '<p>For general enquiries, please write to <a href="mailto:deansoe@suh.edu.in">deansoe@suh.edu.in</a>.</p>' +
      '<h3>Venue</h3><p>Sreenidhi University, Hyderabad, India</p>' +
      '<h3>Key Contacts</h3><ul>' +
      '<li><strong>General Chair:</strong> K. Mohan Raidu – 9985033566 – <a href="mailto:Kmraidu@gmail.com">Kmraidu@gmail.com</a></li>' +
      '<li><strong>General Chair:</strong> Dr. Karthikeyan M – 8903715518 / 8977736828 – <a href="mailto:deansoe@suh.edu.in">deansoe@suh.edu.in</a></li>' +
      '<li><strong>Organizing Chair:</strong> Dr. B. Saritha – 9000801785 – <a href="mailto:saritha.b@suh.edu.in">saritha.b@suh.edu.in</a></li>' +
      '<li><strong>Technical Program Chair:</strong> Prof. S. Lakshminarayana – 9440190121 – <a href="mailto:sln@ieee.org">sln@ieee.org</a></li></ul>')
  ] };

  /* ---------------- MENU ---------------- */
  const L = (label, href, children, cta) => ({ label, href, children: children || [], cta: !!cta });
  const menu = [
    L('HOME', '/'),
    L('COMMITTEE', '/committee'),
    L('AUTHORS', '#', [
      L('Instructions for Authors', '/instructions-for-authors'),
      L('Review Manuscripts', '/review-manuscripts'),
      L('Camera Ready', '/camera-ready'),
      L('Call for Reviewers', '/contact-us')
    ]),
    L('CALL FOR PAPERS', '/call-for-papers'),
    L('IMPORTANT DATES', '/important-dates'),
    L('PROGRAMS', '#', [
      L('Invited Guests', '/invited-guests'), L('Plenary Talks', '/plenary-talks'), L('Keynotes', '/keynotes'),
      L('Speakers', '/speakers'), L('Workshops', '/workshops'), L('Tutorials', '/tutorials'),
      L('Industry Forum', '/industry-forum'), L('Mentoring Program', '/mentoring-program'),
      L('Pre-University STEM Education', '/pre-university-stem'), L('Startup Pitch Competition', '/startup-pitch'),
      L('3MT Competition', '/3mt-competition'),
      L('Student Program', '/student-programs', [
        L('All Student Programs', '/student-programs'), L('Project Expo', '/project-expo'),
        L('Poster Presentation Competition', '/poster-presentation'), L('B.Tech Innovation Initiative', '/btech-innovation'),
        L('Ideathon', '/ideathon')]),
      L('Special Program', '/special-program'), L('Technical Sessions', '/technical-sessions'),
      L('YP Programs', '/yp-programs'), L('Women in Engineering Program', '/wie-program')
    ]),
    L('REGISTRATION', '/registration'),
    L('HOTEL & TRAVEL', '#', [
      L('Visa', '/visa'), L('Visa Letter Request', '/visa-letter'), L('Hotel Information', '/hotels'),
      L('Local Attractions', '/places'), L('Venue Information', '/venue')
    ]),
    L('SPONSORSHIPS', '/sponsorship'),
    L('CONTACT US', '/contact-us'),
    L('SUBMIT PAPER', '/call-for-papers', [], true)
  ];

  return {
    version: 4,
    settings: {
      shortName: 'ICICSE 2027',
      title: title,
      theme: theme,
      mode: 'A Hybrid Conference',
      dates: '10th & 11th December 2027 (tentative)',
      venue: 'Sreenidhi University',
      city: 'Hyderabad, Telangana, India',
      sponsoredBy: 'IEEE CS Hyderabad Section and Sreenidhi University',
      sponsorLabel: 'Financially Sponsored by',
      badge: 'IEEE Conference',
      contactEmail: 'deansoe@suh.edu.in',
      countdownTarget: '2027-12-10T09:00',
      logoText: 'ICICSE',
      logoImage: '',
      footerText: '© 2027 ICICSE – IEEE International Conference on Intelligent, Connected and Sustainable Engineering. All rights reserved.',
      footerNote: 'Financially sponsored by IEEE CS Hyderabad Section and Sreenidhi University. Hero photographs: Wikimedia Commons contributors (see each file page for its licence).',
      topLinks: [
        { label: 'IEEE.org', url: 'https://www.ieee.org/' },
        { label: 'IEEE Xplore', url: 'https://ieeexplore.ieee.org/' },
        { label: 'IEEE Computer Society', url: 'https://www.computer.org/' },
        { label: 'IEEE Hyderabad Section', url: 'https://ieeehyd.org/' }
      ],
      partners: [
        { name: 'IEEE CS Hyderabad Section', url: 'https://ieeehyd.org/', image: '' },
        { name: 'Sreenidhi University', url: '', image: '' }
      ],
      footerLinks: [
        { label: 'HOME', url: '/' },
        { label: 'SITEMAP', url: 'https://www.ieee.org/sitemap.html' },
        { label: 'ACCESSIBILITY', url: 'https://www.ieee.org/accessibility-statement.html' },
        { label: 'NONDISCRIMINATION POLICY', url: 'https://www.ieee.org/about/help/nondiscrimination.html' },
        { label: 'IEEE PRIVACY POLICY', url: 'https://www.ieee.org/security-privacy.html' },
        { label: 'TERMS', url: 'https://www.ieee.org/about/help/terms-conditions.html' }
      ],
      socials: [
        { icon: 'fa-brands fa-linkedin-in', url: 'https://www.linkedin.com' },
        { icon: 'fa-brands fa-x-twitter', url: 'https://twitter.com' },
        { icon: 'fa-brands fa-facebook-f', url: 'https://www.facebook.com' },
        { icon: 'fa-brands fa-instagram', url: 'https://www.instagram.com' },
        { icon: 'fa-brands fa-youtube', url: 'https://www.youtube.com' }
      ],
      popup: {
        enabled: true,
        badge: 'Important Update',
        title: 'Call for Papers is Open',
        text: 'Submit your original research to ICICSE 2027 and join us for two days of research presentations, networking and professional development.',
        deadlineLabel: 'Manuscript Submission Deadline',
        deadline: '10 August 2027',
        deadlineNote: 'Submit early to avoid last-minute issues',
        button: 'Continue to Conference Website'
      },
      colors: {
        primary: '#005A9C', primaryDark: '#003A6B', accent: '#0099D8', navActive: '#005A9C', cta: '#005A9C', bg: '#F8F8F8', text: '#333333',
        card: '#FFFFFF', headerBg: '#F7FAFE', headerBg2: '#DBF0FC', nav: '#0099D8', footer: '#005A9C', muted: '#6B7280'
      },
      font: 'sans'
    },
    menu,
    pages
  };
};
