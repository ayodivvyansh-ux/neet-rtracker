import { NEET_CHAPTERS } from '../src/data/neetSyllabus';

function testPhysicsChapterStructure() {
  console.log('Testing Physics Chapter Structure in NEET_CHAPTERS...');

  const physChapters = NEET_CHAPTERS.Physics.map((c) => c.name);

  const hasCenterOfMass = physChapters.includes('Center of Mass');
  const hasRotationalMotion = physChapters.includes('Rotational Motion');
  const hasCombined = physChapters.includes('System of Particles and Rotational Motion');

  console.log('Has "Center of Mass":', hasCenterOfMass);
  console.log('Has "Rotational Motion":', hasRotationalMotion);
  console.log('Has "System of Particles and Rotational Motion":', hasCombined);

  if (!hasCenterOfMass) {
    console.error('FAIL: "Center of Mass" chapter missing!');
    process.exit(1);
  }

  if (!hasRotationalMotion) {
    console.error('FAIL: "Rotational Motion" chapter missing!');
    process.exit(1);
  }

  if (hasCombined) {
    console.error('FAIL: "System of Particles and Rotational Motion" should be removed!');
    process.exit(1);
  }

  console.log('ALL PHYSICS CHAPTER ASSERTIONS PASSED PERFECTLY!');
}

testPhysicsChapterStructure();
