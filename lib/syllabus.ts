// The chapters a student can practise before any paper covers them (Practice → "Pick a subject and chapter").
// Class 8, NCERT, from the 2025 books. Checked on 16 Nov 2026 against two chapter lists that agreed:
// bharatnotes.com/ncert/new-ncert/class-8/curiosity and school.careers360.com/ncert/ncert-books-for-class-8-science
// (Science: Curiosity, 13 chapters), and teachoo / extramarks for Maths (Ganita Prakash, parts 1 and 2).
// Science is one book; its chapters are split into Physics, Chemistry and Biology because the plan is NEET.
// Chapter 1 (the scientific method) and chapter 13 (Earth) fit no one subject and are left out of practice for now.
// Chapters seen on the student's own papers are added to these lists at run time (lib/practice.ts).

export const CLASS_LEVEL = "Class 8 (CBSE, NCERT)";

export const SYLLABUS: Record<string, string[]> = {
  Physics: [
    "Electricity: Magnetic and Heating Effects",
    "Exploring Forces",
    "Pressure, Winds, Storms, and Cyclones",
    "Light: Mirrors and Lenses",
    "Keeping Time with the Skies",
  ],
  Chemistry: [
    "Particulate Nature of Matter",
    "Nature of Matter: Elements, Compounds, and Mixtures",
    "The Amazing World of Solutes, Solvents, and Solutions",
  ],
  Biology: [
    "The Invisible Living World: Beyond Our Naked Eye",
    "Health: The Ultimate Treasure",
    "How Nature Works in Harmony",
  ],
  Maths: [
    "A Square and A Cube",
    "Power Play",
    "A Story of Numbers",
    "Quadrilaterals",
    "Number Play",
    "We Distribute, Yet Things Multiply",
    "Proportional Reasoning",
    // Part 2. Its first chapter's name was found in one source only (extramarks); the rest in two.
    "Fractions in Disguise",
    "The Baudhayana-Pythagoras Theorem",
    "Exploring Some Geometrical Themes",
    "Tales by Dots and Lines",
    "Algebra Play",
    "Area",
  ],
};

export const SUBJECTS = Object.keys(SYLLABUS);
