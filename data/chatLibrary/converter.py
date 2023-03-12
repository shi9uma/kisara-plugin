# -*- coding: utf-8 -*-

import pandas as pd
import numpy as np
import json
import collections
import os

WORKDIR = os.getcwd()
RAWDATADIR = '{}/raw'.format(WORKDIR)
OUTPUTDATADIR = '{}/data'.format(WORKDIR)

xlsFileList = os.listdir(RAWDATADIR)

for fileName in xlsFileList:
    fileName = os.path.join(RAWDATADIR, fileName)
    rawData = pd.read_csv(fileName, encoding='utf-8', seq = ',')
print(rawData)