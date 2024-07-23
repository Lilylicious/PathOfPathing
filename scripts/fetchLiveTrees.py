import requests
import json
import precalculate
import time
import sys


def main(tree_type, version):
    if tree_type == 'skilltree' or tree_type == 'both':
        fetchAndPrepTree('skilltree', version)
    if tree_type == 'both':
        time.sleep(3)
    if tree_type == 'atlas':
        fetchAndPrepTree('atlas', version)


def fetchAndPrepTree(tree_type, version):
    version_number = version
    if tree_type == 'atlas':
        version_number = version_number + "-atlas"
        url = 'https://www.pathofexile.com/atlas-skill-tree'
    else:
        url = 'https://www.pathofexile.com/passive-skill-tree'
    headers = {
        'User-Agent': 'Path of Pathing/1.0 (contact lily.hammerskog@gmail.com)'
    }

    r = requests.get(url, headers=headers)
    lines = str.splitlines(r.text, keepends=True)

    json_text = ""

    found_tree = False
    for line in lines:
        if line.find('};') != -1:
            json_text += '}'
            break
        if line.find('var passiveSkillTreeData =') != -1:
            found_tree = True
            json_text += '{'
            continue
        if found_tree:
            json_text += line.strip()

    json_tree = json.loads(json_text)

    with open('../dist/data/skill-trees/' + version_number + 'SkillTree.json', 'w') as fd:
        fd.write(json.dumps(json_tree, indent=4))

    precalculate.main('../dist/data/skill-trees/' + version_number)


if __name__ == "__main__":
    if len(sys.argv) == 1:
        main('both', "3.25.0")
    else:
        main(sys.argv[1], sys.argv[2])
