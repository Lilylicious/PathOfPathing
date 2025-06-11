from io import BytesIO
from urllib.request import urlopen
from zipfile import ZipFile
import os
from github import Github
import re
import precalculate
import shutil
import time
import sys


def main(tree_type):
    if tree_type == 'skilltree' or tree_type == 'both':
        fetchAndPrepTree('skilltree')
        print("Skilltree done")
    if tree_type == 'both':
        print("Waiting for rate limit purposes")
        time.sleep(3)
    if tree_type == 'atlas' or tree_type == 'both':
        fetchAndPrepTree('atlas')
        print("Atlas done")


def fetchAndPrepTree(tree_type):
    folder_path = '../dist/data/skill-trees/'
    if tree_type == 'atlas':
        github_repo = "atlastree-export"
    else:
        github_repo = "skilltree-export"
    with Github() as g:
        branch = g.get_repo("grindinggear/" + github_repo).get_branch("master")
        message = branch.commit.commit.message

        match = re.search('^\\d\\.\\d+\\.\\d', message)
        version_number = base_version = (match and match.group(0) or 'unknown')
        print('Found version', version_number)
    if version_number == 'unknown':
        print('No version number found')
        sys.exit()

    if tree_type == 'atlas':
        version_number = version_number + '-atlas'

    zipurl = 'https://github.com/grindinggear/' + github_repo + '/archive/refs/tags/' + base_version + '.zip'
    if os.path.isdir(folder_path + version_number):
        shutil.rmtree(folder_path + version_number)
        print("Removed old files")

    with urlopen(zipurl) as zipresp:
        with ZipFile(BytesIO(zipresp.read())) as zfile:
            zfile.extractall(folder_path)

    os.rename(folder_path + github_repo + '-' + base_version, folder_path + version_number)
    os.rename(folder_path + version_number + '/data.json', folder_path + version_number + '/SkillTree.json', )

    try:
        os.remove(folder_path + version_number + "/README.md")
    except OSError as e:
        pass

    try:
        os.remove(folder_path + version_number + "/ruthless.json")
    except OSError as e:
        pass

    print("Downloaded and created folders for version " + version_number)

    precalculate.main(folder_path + version_number)

    print("Generated distances")

    with open('../models/versions/verions.ts', 'r') as f:
        data = f.readlines()
    new_version_line = ('    public static v'
                        + version_number.replace('.', '_').replace('-', '_')
                        + ' = new SemVer("'
                        + version_number + '");\n')

    if data[-2] == new_version_line or data[-3] == new_version_line:
        print("Same line")
    else:
        data.insert(-1, new_version_line)
        with open('../models/versions/verions.ts', 'w') as f:
            contents = "".join(data)
            f.write(contents)


if __name__ == "__main__":
    if len(sys.argv) == 1:
        main('both')
    else:
        main(sys.argv[1])
