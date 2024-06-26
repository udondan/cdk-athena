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

validate-package:
	@echo -e "$(TARGET_COLOR)Checking package content$(NO_COLOR)"
	@npm publish --dry-run 2>&1 | tee publish_output.txt
	@\
	FILES_TO_CHECK="lambda/code.zip lib/index.d.ts lib/index.js lib/lambda.d.ts lib/lambda.js lib/namedQuery.d.ts lib/namedQuery.js lib/types.d.ts lib/types.js lib/workGroup.d.ts lib/workGroup.js"; \
	MISSING_FILES=""; \
	for file in $$FILES_TO_CHECK; do \
		if ! grep -q $$file publish_output.txt; then \
			MISSING_FILES="$$MISSING_FILES $$file"; \
		fi; \
	done; \
	if [ -n "$$MISSING_FILES" ]; then \
		echo "❌ The following files are NOT included in the package:$$MISSING_FILES"; \
		rm publish_output.txt; \
		exit 1; \
	fi
	@rm publish_output.txt
