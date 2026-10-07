-- Libelles officiels des zones d'accreditation (saison 2026-27)
update public.accreditation_zones_ref as z
set libelle = v.libelle
from (values
  (1, 'Terrain'),
  (2, 'Plateau / Zone mixte et médias'),
  (3, 'Espace logistique / Vestiaires'),
  (4, 'Tribune officielle'),
  (5, 'Salon partenaires'),
  (6, 'Espace bénévole et salon club')
) as v(zone_id, libelle)
where z.zone_id = v.zone_id;

select zone_id, libelle from public.accreditation_zones_ref order by zone_id;
