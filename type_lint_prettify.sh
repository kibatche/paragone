#! /usr/bin/env bash

set -e

echo '[Vérification du typage avec Typescript]'
bunx tsc --noEmit && echo 'Typage OK' || echo 'Typage PAS OK'

echo '[Vérification des bugs potentiels avec Eslint]'
bunx eslint '**/*.ts' && echo 'Lintage OK' || echo 'Typage PAS OK'

echo '[Vérification et formatage du code avec Prettier]'
bunx prettier -c '**/*.ts' --write && echo 'Formatage OK' || echo 'Typage PAS OK'
