window.ATLAS = (function () {
  const C = [
    { id: 1, tz: 1, name: "Priya Raghunathan", city: "Lisbon", lat: 38.72, lon: -9.14, homeCity: "Chennai", homeLat: 13.08, homeLon: 80.27, job: "Product designer", company: "Miró", met: "Design week in Rotterdam, 2017 — we shared a table because the hall was full.", bday: "4 Mar", langs: ["Tamil", "English", "Portuguese"], gift: "Linocut prints, anything letterpress", notes: "Moved for the light. Hates phone calls, will answer voice notes instantly.", months: 2, synced: true, tags: ["design", "lisbon"], conn: [2, 5] },
    { id: 2, tz: 2, name: "Marco Bellini", city: "Milan", lat: 45.46, lon: 9.19, homeCity: "Bari", homeLat: 41.12, homeLon: 16.87, job: "Structural engineer", company: "Fassi", met: "Climbing gym in Milan — belayed each other for a year before exchanging names.", bday: "22 Jul", langs: ["Italian", "English"], gift: "Single-origin espresso, chalk bags", notes: "New daughter, Giulia. Don't call before 10am.", months: 5, synced: false, tags: ["climbing", "work"], conn: [1] },
    { id: 3, tz: 3, name: "Ayaan Karim", city: "Nairobi", lat: -1.29, lon: 36.82, homeCity: "Mombasa", homeLat: -4.04, homeLon: 39.67, job: "Journalist", company: "The Standard", met: "Reporting trip, Kigali 2019. He lent me a charger and never asked for it back.", bday: "11 Nov", langs: ["Swahili", "English"], gift: "Hardback notebooks, good pens", notes: "Writing a book on coastal trade. Ask about it.", months: 11, synced: false, tags: ["press"], conn: [] },
    { id: 4, tz: 2, name: "Hanne Dahl", city: "Oslo", lat: 59.91, lon: 10.75, homeCity: "Bergen", homeLat: 60.39, homeLon: 5.32, job: "Marine biologist", company: "Institute of Marine Research", met: "Overnight ferry to Bergen, both awake at 4am on deck.", bday: "30 Jan", langs: ["Norwegian", "English"], gift: "Wool socks, sea charts", notes: "Field season is Jun–Aug, unreachable. Partner: Erik.", months: 1, synced: true, tags: ["science"], conn: [] },
    { id: 5, tz: 1, name: "Sofia Almeida", city: "Lisbon", lat: 38.72, lon: -9.14, homeCity: "Porto", homeLat: 41.15, homeLon: -8.61, job: "Ceramicist", company: "Studio Almeida", met: "Through Priya, at a kiln opening in Alcântara.", bday: "17 May", langs: ["Portuguese", "English", "Spanish"], gift: "Japanese glazes, kiln tools", notes: "Trying to buy the studio she rents. Big year.", months: 3, synced: false, tags: ["lisbon", "art"], conn: [1] },
    { id: 6, tz: 1, name: "Daniel Okonkwo", city: "Lagos", lat: 6.52, lon: 3.38, homeCity: "Enugu", homeLat: 6.46, homeLon: 7.55, job: "Product manager", company: "Paystack", met: "Batch dinner, 2021. Argued about pricing for three hours.", bday: "2 Sep", langs: ["Igbo", "English"], gift: "Anything Arsenal, obscure jazz vinyl", notes: "Mother's health has been poor — check in gently.", months: 7, synced: true, tags: ["work", "fintech"], conn: [] },
    { id: 7, tz: 9, name: "Yuki Tanaka", city: "Tokyo", lat: 35.68, lon: 139.69, homeCity: "Sapporo", homeLat: 43.06, homeLon: 141.35, job: "Illustrator", company: "Freelance", met: "Art book fair in Tokyo, 2018 — bought her last zine.", bday: "14 Feb", langs: ["Japanese", "English"], gift: "Fountain pen ink, washi", notes: "Slow to reply, always replies. Prefers letters.", months: 14, synced: false, tags: ["art"], conn: [] },
    { id: 8, tz: 2, name: "Clara Fuchs", city: "Vienna", lat: 48.21, lon: 16.37, homeCity: "Graz", homeLat: 47.07, homeLon: 15.44, job: "Cellist", company: "Wiener Symphoniker", met: "University orchestra, second desk. Fifteen years ago.", bday: "8 Aug", langs: ["German", "English"], gift: "Rosin, concert tickets", notes: "Touring Sep–Nov. Her mother is unwell.", months: 4, synced: false, tags: ["music", "old friends"], conn: [] },
    { id: 9, tz: -6, name: "Tomás Herrera", city: "Mexico City", lat: 19.43, lon: -99.13, homeCity: "Oaxaca", homeLat: 17.07, homeLon: -96.72, job: "Chef", company: "Cenizo", met: "Supper club in Roma Norte — I was seated in the kitchen.", bday: "25 Jun", langs: ["Spanish", "English"], gift: "Mezcal, knife sharpening", notes: "Opening a second room in Oaxaca next spring.", months: 9, synced: true, tags: ["food"], conn: [] },
    { id: 10, tz: 4, name: "Nadia Petrova", city: "Tbilisi", lat: 41.72, lon: 44.78, homeCity: "Sofia", homeLat: 42.7, homeLon: 23.32, job: "Literary translator", company: "Freelance", met: "Writers' residency, 2016. Shared a kitchen and a deadline.", bday: "3 Dec", langs: ["Bulgarian", "Russian", "Georgian", "English"], gift: "Untranslated novels", notes: "Left Sofia for good. Don't ask when she's moving back.", months: 6, synced: false, tags: ["writing"], conn: [12] },
    { id: 11, tz: 10, name: "Ben Whitaker", city: "Melbourne", lat: -37.81, lon: 144.96, homeCity: "Perth", homeLat: -31.95, homeLon: 115.86, job: "Sound engineer", company: "Freelance", met: "Festival crew, 2015. Two weeks of no sleep.", bday: "19 Apr", langs: ["English"], gift: "Cables, always cables", notes: "Went quiet after the split. Worth a real call.", months: 18, synced: false, tags: ["music"], conn: [] },
    { id: 12, tz: -4, name: "Leila Haddad", city: "Montréal", lat: 45.5, lon: -73.57, homeCity: "Beirut", homeLat: 33.89, homeLon: 35.5, job: "Architect", company: "Atelier Nord", met: "Conference in Beirut, 2019 — she corrected my pronunciation all week.", bday: "6 Oct", langs: ["Arabic", "French", "English"], gift: "Drafting tools, poetry", notes: "Engaged to Rami. Wedding likely next summer.", months: 2, synced: true, tags: ["design", "old friends"], conn: [10] }
  ];

  const UPDATES = [
    { id: "u1", who: 1, kind: "Location", text: "Priya updated her city to Lisbon, Portugal", was: "Rotterdam", detail: "Your card still lists Rotterdam.", when: "2 days ago" },
    { id: "u2", who: 2, kind: "Work", text: "Marco started a new role at Fassi", was: "Structural engineer, Redesco", detail: "Title unchanged, company differs.", when: "5 days ago" },
    { id: "u3", who: 12, kind: "Life event", text: "Leila is engaged", was: null, detail: "No matching note on her card.", when: "1 week ago" },
    { id: "u4", who: 7, kind: "Birthday", text: "Yuki's birthday is in 11 days", was: null, detail: "You last spoke 14 months ago.", when: "today" }
  ];

  const HISTORY = {
    1: [{ d: "10 Sep 2026", k: "Location", t: "City changed to Lisbon, Portugal" }, { d: "2 Mar 2026", k: "Profile", t: "New profile photo" }, { d: "14 Nov 2025", k: "Work", t: "Started at Mir\u00f3" }],
    2: [{ d: "7 Sep 2026", k: "Work", t: "Started a new role at Fassi" }, { d: "19 Jun 2026", k: "Life event", t: "Welcomed a daughter, Giulia" }, { d: "3 Jan 2025", k: "Location", t: "City changed to Milan" }],
    3: [{ d: "22 Apr 2026", k: "Work", t: "Byline moved to The Standard" }, { d: "8 Aug 2025", k: "Profile", t: "Added \u2018writing a book on coastal trade\u2019" }],
    4: [{ d: "11 Sep 2026", k: "Profile", t: "Cover photo from Svalbard" }, { d: "30 May 2026", k: "Life event", t: "Relationship: Erik" }],
    5: [{ d: "1 Aug 2026", k: "Work", t: "Studio Almeida listed as own business" }, { d: "12 Feb 2025", k: "Location", t: "Porto \u2192 Lisbon" }],
    6: [{ d: "5 Sep 2026", k: "Work", t: "Promoted at Paystack" }, { d: "17 Mar 2026", k: "Profile", t: "Joined group: Arsenal Lagos" }],
    7: [{ d: "20 Jun 2026", k: "Profile", t: "Portfolio link updated" }, { d: "9 Oct 2025", k: "Location", t: "Sapporo \u2192 Tokyo" }],
    8: [{ d: "28 Aug 2026", k: "Work", t: "Tour dates posted, Sep\u2013Nov" }, { d: "14 Apr 2026", k: "Profile", t: "New profile photo" }],
    9: [{ d: "2 Sep 2026", k: "Work", t: "Cenizo second location announced" }, { d: "25 Jun 2026", k: "Birthday", t: "Turned 41" }],
    10: [{ d: "16 Jul 2026", k: "Location", t: "Sofia \u2192 Tbilisi" }, { d: "4 Feb 2026", k: "Work", t: "Translation prize longlist" }],
    11: [{ d: "3 Mar 2026", k: "Life event", t: "Relationship status changed" }, { d: "11 Nov 2024", k: "Profile", t: "New profile photo" }],
    12: [{ d: "6 Sep 2026", k: "Life event", t: "Engaged to Rami" }, { d: "21 Jan 2026", k: "Work", t: "Atelier Nord, senior architect" }]
  };

  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const TODAY = new Date(2026, 8, 12);

  function daysToBirthday(bday) {
    const parts = String(bday).trim().split(/\s+/);
    const day = parseInt(parts[0], 10);
    const mi = MONTHS.indexOf(parts[1]);
    if (isNaN(day) || mi < 0) return null;
    let next = new Date(TODAY.getFullYear(), mi, day);
    if (next < TODAY) next = new Date(TODAY.getFullYear() + 1, mi, day);
    return Math.round((next - TODAY) / 86400000);
  }

  function birthdayLabel(bday) {
    const d = daysToBirthday(bday);
    if (d === null) return "";
    if (d === 0) return "today";
    if (d === 1) return "tomorrow";
    if (d < 45) return "in " + d + " days";
    const w = Math.round(d / 30.5);
    return "in " + w + " months";
  }

  function historyFor(id) {
    return (HISTORY[id] || []).slice();
  }

  function project(lat, lon, rot, r, cx, cy) {
    const lam = ((lon + rot) * Math.PI) / 180;
    const phi = (lat * Math.PI) / 180;
    const x = Math.cos(phi) * Math.sin(lam);
    const y = Math.sin(phi);
    const z = Math.cos(phi) * Math.cos(lam);
    return { x: cx + r * x, y: cy - r * y, visible: z > -0.02, z: z };
  }

  function meridians(rot, r) {
    const out = [];
    for (let lon = -180; lon < 180; lon += 30) {
      const lam = ((lon + rot) * Math.PI) / 180;
      out.push({ key: lon, rx: Math.abs(r * Math.sin(lam)), front: Math.cos(lam) > 0 });
    }
    return out;
  }

  function parallels(r) {
    return [-60, -30, 0, 30, 60].map(function (lat) {
      const phi = (lat * Math.PI) / 180;
      return { key: lat, dy: -r * Math.sin(phi), half: r * Math.cos(phi), major: lat === 0 };
    });
  }

  function fade(months) {
    if (months <= 2) return 1;
    if (months >= 18) return 0.26;
    return 1 - ((months - 2) / 16) * 0.74;
  }

  function warmth(months) {
    return months <= 3 ? "recent" : months <= 8 ? "cooling" : "cold";
  }

  function lastSpoke(months) {
    if (months === 0) return "today";
    if (months <= 1) return "last month";
    if (months < 12) return months + " months ago";
    const y = Math.floor(months / 12), m = months % 12;
    return y + (y > 1 ? " years" : " year") + (m ? " " + m + "m" : "") + " ago";
  }

  function cities(list) {
    const map = {};
    list.forEach(function (c) {
      if (!map[c.city]) map[c.city] = { city: c.city, lat: c.lat, lon: c.lon, people: [] };
      map[c.city].people.push(c);
    });
    return Object.keys(map).map(function (k) { return map[k]; });
  }

  function citiesWestToEast(list) {
    return cities(list).sort(function (a, b) { return a.lon - b.lon; });
  }

  return { contacts: C, updates: UPDATES, project, meridians, parallels, fade, warmth, lastSpoke, cities, citiesWestToEast, daysToBirthday, birthdayLabel, historyFor };
})();
