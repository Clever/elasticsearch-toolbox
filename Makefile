# usage:
# `make` or `make test` runs all the tests
# `make api` runs just that test

.PHONY: test build $(TESTS)
TESTS = $(patsubst %.ts,%,$(wildcard test/*.ts))


all: build test

build:
	npm install

run:
	npm run-script dev-server

test: $(TESTS)

$(TESTS):
	$(TEST_ENV) node_modules/mocha/bin/mocha --require ts-node/register --ignore-leaks --timeout 1000 test/$@.ts
