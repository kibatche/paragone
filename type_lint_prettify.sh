#! /usr/bin/env bash
echo '[Vérification du typage avec Typescript]'
bunx tsc --noEmit
echo '[Vérification des bugs potentiels avec Eslint]'
bunx eslint '**/*.ts'
ec ho ''[Vérification et formatage du code avec Prettier]'
bunx prettier -c '**/*.ts' --write