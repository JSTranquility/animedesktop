# Publicación y mantenimiento

Repositorio oficial: [JSTranquility/animedesktop](https://github.com/JSTranquility/animedesktop).

La publicación inicial conserva el commit de licencia creado en GitHub. El código usa MIT y mantiene la atribución de esa licencia. Los recursos externos y los datos locales quedan fuera del historial.

## Validar cambios

```bash
npm test
python3 scripts/audit-publication.py
python3 tests/nested.py --preferences
```

Las pruebas gráficas necesitan GNOME 51 y un entorno que permita el compositor aislado; no se ejecutan como parte del trabajo portable de GitHub Actions.

## Preparar una versión

```bash
git add -A
python3 scripts/audit-publication.py
python3 scripts/package-source.py
git diff --cached --stat
git commit -m "Describe el cambio"
git push origin main
```

El archivo en `dist/` se construye desde el índice revisado y está excluido de Git. Puede adjuntarse a una release cuando se publique una versión; no es un paquete independiente para GNOME Extensions Store.

Revisa el [registro de validación](VALIDATION.md) y el [estado de GitHub Actions](https://github.com/JSTranquility/animedesktop/actions). Un trabajo de CI verde comprueba las pruebas portables, no HDMI físico ni rendimiento GPU.

Referencias oficiales: [código local a GitHub](https://docs.github.com/en/migrations/importing-source-code/using-the-command-line-to-import-source-code/adding-locally-hosted-code-to-github), [crear un repositorio](https://docs.github.com/en/repositories/creating-and-managing-repositories/creating-a-new-repository).
