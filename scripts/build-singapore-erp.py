"""Build the bundled ERP geometries from LTA's gantry shapefile.
Usage: python scripts/build-singapore-erp.py /path/to/ERPGantry_Sep2026.zip
Requires pyshp and pyproj. Download source is recorded in the output.
"""
import hashlib,json,sys,tempfile,zipfile
from pathlib import Path
import shapefile
from pyproj import CRS,Transformer
source=Path(sys.argv[1])
with tempfile.TemporaryDirectory() as tmp:
 with zipfile.ZipFile(source) as z:z.extractall(tmp)
 path=next(Path(tmp).rglob('*.shp'))
 transform=Transformer.from_crs(CRS.from_wkt(path.with_suffix('.prj').read_text()),'EPSG:4326',always_xy=True)
 records=[];seen=set()
 for row in shapefile.Reader(str(path)).iterShapeRecords():
  p=row.record.as_dict()
  # The file includes EMAS, height limits and directional gantries. P alone is ERP.
  if p['TYP_CD']!='P':continue
  parts=list(row.shape.parts)+[len(row.shape.points)]
  lines=[]
  for a,b in zip(parts,parts[1:]):
   line=[[round(lon,7),round(lat,7)] for lon,lat in (transform.transform(*xy) for xy in row.shape.points[a:b])]
   if len(line)>1:lines.append(line)
  key=json.dumps(lines)
  if not lines or key in seen:continue
  seen.add(key)
  number=str(p['GNTRY_NUM']).strip()
  records.append({'id':'lta-erp-'+str(len(records)+1),'number':number if number and number!='UNK' else None,'road_code':p['RD_CD'],'level':int(p['LVL_NUM']),'lines':lines})
 data={'source':'Land Transport Authority — ERP Gantry, September 2026','source_url':'https://datamall.lta.gov.sg/content/dam/datamall/datasets/Geospatial/ERPGantry_Sep2026.zip','source_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'published':'2026-09','licence':'Singapore Open Data Licence','licence_url':'https://data.gov.sg/open-data-licence','notes':'Physical ERP locations only; operation, charges and ERP 2 charging zones are not inferred from this geometry. Non-ERP gantries are excluded using LTA TYP_CD=P.','gantries':records}
 Path('assets/singapore-erp.json').write_text(json.dumps(data,separators=(',',':'))+'\n')
 print(len(records),'ERP geometries written')
