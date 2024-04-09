SHELL := /bin/bash

build:
	@npm run build

package: build
	@npm run package

test: build
	@lambda/build
	@cd test && npm run build && cdk deploy

clean:
	@rm -rf node_modules package-lock.json test/node_modules test/package-lock.json

install:
	@echo -e "$(TARGET_COLOR)Running install$(NO_COLOR)"
	@npm clean-install --prefer-offline --cache .npm
	@npm list

eslint:
	@echo -e "$(TARGET_COLOR)Running eslint $$(npx eslint --version)$(NO_COLOR)"
	@npx eslint .; \
	echo "Passed"
