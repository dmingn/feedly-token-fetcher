.PHONY: create-github-release
create-github-release:
	@VERSION=$(shell jq -r .version package.json) && \
	echo "Creating release for version $$VERSION" && \
	gh release create v$$VERSION --generate-notes
