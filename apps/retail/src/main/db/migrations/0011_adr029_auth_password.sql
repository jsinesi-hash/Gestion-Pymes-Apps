-- ADR-029: eliminar uso de pin_rapido; autenticación unificada por hash_password
UPDATE usuario SET pin_rapido = NULL;
