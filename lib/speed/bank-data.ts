// Question bank text. One block per question, blocks separated by a line with three dashes.
// Fields: topic, step (1 to 8), q, options a) b) c) d), answer (the letter), why, source, approved, private.
// A question is only shown when it says approved: yes. Drafts below are standard textbook facts written by Claude
// and wait for Abhishek's approval. To approve one, change its approved line to yes.
// Questions copied from an Olympiad or coaching paper must say private: yes (this family only, never shared).

export const BANK_TEXT = `
topic: motion
step: 2
q: Which of these is a unit of speed?
a) m/s²
b) km/h
c) kg
d) N
answer: b
why: Speed is distance divided by time, so km/h (kilometres per hour) is a unit of speed. m/s² is for acceleration.
source: Draft by Claude, standard textbook fact. Needs Abhishek's approval.
approved: no
private: no
---
topic: motion
step: 3
q: A car's speedometer shows 60 km/h. What does this reading tell you?
a) The distance covered so far
b) The speed at that moment
c) The average speed of the whole journey
d) The time the journey has taken
answer: b
why: A speedometer shows the speed at that moment.
source: Draft by Claude, standard textbook fact. Needs Abhishek's approval.
approved: no
private: no
---
topic: motion
step: 4
q: The distance-time graph of a moving object is a straight sloping line. What does this show?
a) The object is at rest
b) The object moves at a constant speed
c) The object is speeding up
d) The object is moving backwards
answer: b
why: A straight sloping line means equal distances in equal times: a constant speed. A flat line would mean at rest.
source: Draft by Claude, standard textbook fact. Needs Abhishek's approval.
approved: no
private: no
---
topic: motion
step: 5
q: A car moves around a circular track at a constant speed. Which statement is correct?
a) Its velocity is constant
b) Its speed is constant but its velocity changes
c) Its speed changes but its velocity is constant
d) Neither its speed nor its velocity changes
answer: b
why: Velocity includes direction. The direction keeps changing on a circle, so the velocity changes even though the speed does not.
source: Draft by Claude, standard textbook fact. Needs Abhishek's approval.
approved: no
private: no
---
topic: pressure
step: 2
q: Why does a sharp knife cut better than a blunt one?
a) Its smaller edge area gives more pressure for the same force
b) It is heavier
c) It needs less force on any surface
d) It is hotter
answer: a
why: Pressure = force ÷ area. A thinner edge has a smaller area, so the same force gives a much bigger pressure.
source: Draft by Claude, standard textbook fact. Needs Abhishek's approval.
approved: no
private: no
---
topic: pressure
step: 3
q: The same force is pressed on four things. Which one gives the greatest pressure?
a) A wide flat plate
b) The tip of a needle
c) A brick lying flat
d) A tyre on the road
answer: b
why: The needle tip has the smallest area, so the pressure is the greatest.
source: Draft by Claude, standard textbook fact. Needs Abhishek's approval.
approved: no
private: no
---
topic: pressure
step: 4
q: Why is the air pressure lower at the top of a high mountain?
a) The air is hotter there
b) There is less air above pressing down
c) Gravity stops working
d) Wind blows the air away
answer: b
why: Air pressure comes from the weight of the air above. Higher up, there is less air above.
source: Draft by Claude, standard textbook fact. Needs Abhishek's approval.
approved: no
private: no
---
topic: pressure
step: 5
q: The pressure at a point inside a liquid depends on
a) The shape of the container
b) The depth and the density of the liquid
c) The volume of the liquid only
d) The width of the container
answer: b
why: Liquid pressure = depth × density × g. The shape and width of the container do not matter.
source: Draft by Claude, standard textbook fact. Needs Abhishek's approval.
approved: no
private: no
---
topic: sound
step: 2
q: Sound cannot travel through
a) Water
b) Steel
c) Air
d) A vacuum
answer: d
why: Sound needs a material (solid, liquid or gas) to carry it. A vacuum has none.
source: Draft by Claude, standard textbook fact. Needs Abhishek's approval.
approved: no
private: no
---
topic: sound
step: 3
q: The loudness of a sound depends mainly on its
a) Frequency
b) Amplitude
c) Wavelength
d) Speed
answer: b
why: A bigger amplitude of vibration gives a louder sound.
source: Draft by Claude, standard textbook fact. Needs Abhishek's approval.
approved: no
private: no
---
topic: sound
step: 3
q: The pitch of a sound depends mainly on its
a) Amplitude
b) Frequency
c) Loudness
d) Distance from the listener
answer: b
why: Higher frequency means a higher pitch.
source: Draft by Claude, standard textbook fact. Needs Abhishek's approval.
approved: no
private: no
---
topic: sound
step: 4
q: In which of these does sound travel the fastest?
a) A vacuum
b) Air
c) Water
d) Iron
answer: d
why: Sound is fastest in solids, slower in liquids and slowest in gases. It does not travel in a vacuum.
source: Draft by Claude, standard textbook fact. Needs Abhishek's approval.
approved: no
private: no
---
topic: sound
step: 4
q: Sound travels at about 344 m/s and the ear needs 0.1 s between a sound and its echo. About how far must the reflecting wall be?
a) 5 m
b) 17 m
c) 34 m
d) 344 m
answer: b
why: In 0.1 s the sound covers 34.4 m there and back, so the wall is about 17 m away.
source: Draft by Claude, standard textbook fact. Needs Abhishek's approval.
approved: no
private: no
---
topic: sound
step: 5
q: Which of these frequencies can a normal human ear hear?
a) 10 Hz
b) 15 Hz
c) 1000 Hz
d) 30 000 Hz
answer: c
why: People hear from about 20 Hz to 20 000 Hz.
source: Draft by Claude, standard textbook fact. Needs Abhishek's approval.
approved: no
private: no
---
topic: light
step: 2
q: The image formed by a plane mirror is
a) Real and upside down
b) Virtual, upright and the same size as the object
c) Real and magnified
d) Virtual and magnified
answer: b
why: A plane mirror gives a virtual, upright image the same size as the object, as far behind the mirror as the object is in front.
source: Draft by Claude, standard textbook fact. Needs Abhishek's approval.
approved: no
private: no
---
topic: light
step: 3
q: Which mirror is used as the rear-view mirror of a vehicle?
a) Concave
b) Convex
c) Plane
d) Cylindrical
answer: b
why: A convex mirror gives a wide field of view and an upright, smaller image.
source: Draft by Claude, standard textbook fact. Needs Abhishek's approval.
approved: no
private: no
---
topic: light
step: 4
q: Why does a dentist use a concave mirror?
a) It gives an enlarged, upright image of a tooth held close to it
b) It gives a smaller image of the tooth
c) It keeps the tooth cool
d) It makes the tooth glow
answer: a
why: A concave mirror held close to an object forms an enlarged, upright, virtual image.
source: Draft by Claude, standard textbook fact. Needs Abhishek's approval.
approved: no
private: no
---
topic: light
step: 3
q: Which of these can be used to burn a piece of paper using sunlight?
a) A concave lens
b) A convex lens
c) A plane mirror
d) A piece of plain glass
answer: b
why: A convex lens brings the sun's rays together to a small bright point and heats the paper.
source: Draft by Claude, standard textbook fact. Needs Abhishek's approval.
approved: no
private: no
---
topic: light
step: 6
q: The power of a lens of focal length 25 cm is
a) 0.25 D
b) 2.5 D
c) 4 D
d) 25 D
answer: c
why: P = 100 ÷ f in cm = 100 ÷ 25 = 4 D.
source: Draft by Claude, standard textbook fact. Needs Abhishek's approval.
approved: no
private: no
---
topic: light
step: 8
q: A ray passes through a glass slab with parallel faces. The ray that comes out is
a) Parallel to the incident ray but shifted sideways
b) Bent towards the normal
c) Exactly along the incident ray
d) Perpendicular to the incident ray
answer: a
why: The ray bends in and bends out by the same amount, so it comes out parallel to the original but shifted sideways.
source: Draft by Claude, standard textbook fact. Needs Abhishek's approval.
approved: no
private: no
---
topic: electricity
step: 2
q: Which of these is a good conductor of electricity?
a) Rubber
b) Copper
c) Dry wood
d) Plastic
answer: b
why: Metals such as copper let current flow easily.
source: Draft by Claude, standard textbook fact. Needs Abhishek's approval.
approved: no
private: no
---
topic: electricity
step: 3
q: The SI unit of electric current is
a) Volt
b) Ohm
c) Ampere
d) Watt
answer: c
why: Current is measured in amperes.
source: Draft by Claude, standard textbook fact. Needs Abhishek's approval.
approved: no
private: no
---
topic: electricity
step: 4
q: A fuse protects a circuit because
a) It conducts better than the other wires
b) Its thin wire melts when too much current flows
c) It stores extra charge
d) It raises the voltage
answer: b
why: If the current becomes too high the fuse wire melts and breaks the circuit.
source: Draft by Claude, standard textbook fact. Needs Abhishek's approval.
approved: no
private: no
---
topic: electricity
step: 5
q: The length of a wire is doubled. The material and thickness are the same. Its resistance
a) Is halved
b) Stays the same
c) Doubles
d) Becomes four times
answer: c
why: Resistance is proportional to length, so double the length means double the resistance.
source: Draft by Claude, standard textbook fact. Needs Abhishek's approval.
approved: no
private: no
---
topic: electricity
step: 6
q: Two identical bulbs are joined in parallel across a battery. One bulb is removed. The other bulb
a) Goes off
b) Glows dimmer
c) Glows as before
d) Glows brighter
answer: c
why: In a parallel circuit each bulb has its own path and the same voltage, so removing one does not change the other.
source: Draft by Claude, standard textbook fact. Needs Abhishek's approval.
approved: no
private: no
---
topic: electricity
step: 7
q: The heating effect of current is NOT the main working idea of a
a) Electric iron
b) Geyser
c) Ceiling fan
d) Toaster
answer: c
why: An iron, geyser and toaster work by heating a resistance wire. A fan works by a motor turning a magnet and coil.
source: Draft by Claude, standard textbook fact. Needs Abhishek's approval.
approved: no
private: no
---
`;
