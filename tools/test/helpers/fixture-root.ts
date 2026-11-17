import {mkdtemp,cp,mkdir} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const testDir=fileURLToPath(new URL('../',import.meta.url));
export const contentDir=fileURLToPath(new URL('../fixtures/content/',import.meta.url));
const topicDir='subjects/biochemistry/example-amino-acid-structure';
const copied=['taxonomy',topicDir,'questions/bio-biochem/example-amino-acids-discrete.json'];
// Temp root under tools/test with only what the fixture tests use; copy anything else explicitly in the test.
export async function makeFixtureRoot(prefix:string) {
 const root=await mkdtemp(join(testDir,prefix));
 for(const rel of copied){await mkdir(dirname(join(root,rel)),{recursive:true});await cp(join(contentDir,rel),join(root,rel),{recursive:true});}
 return root;
}
